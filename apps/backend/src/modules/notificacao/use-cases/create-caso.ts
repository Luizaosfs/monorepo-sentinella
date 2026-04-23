import { Injectable, Logger } from '@nestjs/common';

import { EnfileirarScoreImovel } from '../../job/enfileirar-score-imovel';
import { CreateCasoBody } from '../dtos/create-notificacao.body';
import { CasoNotificado } from '../entities/notificacao';
import { NotificacaoWriteRepository } from '../repositories/notificacao-write.repository';
import { CruzarCasoComFocos } from './cruzar-caso-com-focos';

@Injectable()
export class CreateCaso {
  private readonly logger = new Logger(CreateCaso.name);

  constructor(
    private repository: NotificacaoWriteRepository,
    private cruzarCasoComFocos: CruzarCasoComFocos,
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

    // Fase C.4 — hook best-effort. Falha no cruzamento NÃO quebra a criação.
    try {
      await this.cruzarCasoComFocos.execute({
        casoId: created.id,
        clienteId: created.clienteId,
        latitude: created.latitude,
        longitude: created.longitude,
      });
    } catch (err) {
      this.logger.error(
        `Hook CruzarCasoComFocos falhou para caso ${created.id}: ${(err as Error).message}`,
      );
    }

    // Fase F.1.B — enfileira recálculo dos scores territoriais próximos (best-effort)
    if (created.latitude != null && created.longitude != null) {
      await this.enfileirarScore.enfileirarPorCaso(created.id!, created.clienteId);
    }

    return { caso: created };
  }
}
