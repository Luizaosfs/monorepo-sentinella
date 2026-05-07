import { Injectable, Logger } from '@nestjs/common';

import { EnfileirarScoreImovel } from '../../job/enfileirar-score-imovel';
import { CreateCasoBody } from '../dtos/create-notificacao.body';
import { CasoNotificado } from '../entities/notificacao';
import { NotificacaoWriteRepository } from '../repositories/notificacao-write.repository';
import { CriarFocoDeCasoNotificado } from './criar-foco-de-caso-notificado';
import { CruzarCasoComFocos } from './cruzar-caso-com-focos';

@Injectable()
export class CreateCaso {
  private readonly logger = new Logger(CreateCaso.name);

  constructor(
    private repository: NotificacaoWriteRepository,
    private cruzarCasoComFocos: CruzarCasoComFocos,
    private criarFocoDeCasoNotificado: CriarFocoDeCasoNotificado,
    private enfileirarScore: EnfileirarScoreImovel,
  ) {}

  async execute(
    clienteId: string,
    userId: string | undefined,
    input: CreateCasoBody,
  ): Promise<{ caso: CasoNotificado }> {
    const entity = new CasoNotificado(
      {
        clienteId,
        unidadeSaudeId: input.unidadeSaudeId,
        notificadorId: userId,
        doenca: input.doenca ?? 'suspeito',
        status: input.status ?? 'suspeito',
        dataInicioSintomas: input.dataInicioSintomas,
        dataNotificacao: input.dataNotificacao ?? new Date(),
        logradouroBairro: input.logradouroBairro,
        bairro: input.bairro,
        latitude: input.latitude,
        longitude: input.longitude,
        regiaoId: input.regiaoId,
        observacao: input.observacao,
        payload: input.payload,
        createdBy: userId,
      },
      {},
    );
    const created = await this.repository.createCaso(entity);

    // E.1.1 — Fase 1: cruzar com focos existentes (dedupe ampla, raio centralizado).
    // Retorna principalFocoId=null se nenhum foco ativo foi encontrado no raio.
    let principalFocoId: string | null = null;
    try {
      const resultado = await this.cruzarCasoComFocos.execute({
        casoId: created.id,
        clienteId: created.clienteId,
        latitude: created.latitude,
        longitude: created.longitude,
      });
      principalFocoId = resultado.principalFocoId;
    } catch (err) {
      this.logger.error(
        `Hook CruzarCasoComFocos falhou para caso ${created.id}: ${(err as Error).message}`,
      );
    }

    // E.1.1 — Fase 2: se nenhum foco existente foi encontrado, criar foco epidemiológico
    // (ou marcar como pendente_geocodificacao se sem coordenadas).
    if (principalFocoId === null) {
      try {
        await this.criarFocoDeCasoNotificado.execute({
          casoId: created.id!,
          clienteId: created.clienteId,
          latitude: created.latitude,
          longitude: created.longitude,
          regiaoId: created.regiaoId,
          statusCaso: created.status,
        });
      } catch (err) {
        this.logger.error(
          `Hook CriarFocoDeCasoNotificado falhou para caso ${created.id}: ${(err as Error).message}`,
        );
      }
    }

    // Fase F.1.B — enfileira recálculo dos scores territoriais próximos (best-effort)
    if (created.latitude != null && created.longitude != null) {
      try {
        await this.enfileirarScore.enfileirarPorCaso(created.id!, created.clienteId);
      } catch (err) {
        this.logger.error(
          `[CreateCaso] Falha ao enfileirar score por caso ${created.id}: ${(err as Error).message}`,
          (err as Error).stack,
        );
      }
    }

    return { caso: created };
  }
}
