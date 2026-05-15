import { Injectable, Logger } from '@nestjs/common';

import { EnfileirarScoreImovel } from '../../job/enfileirar-score-imovel';
import { CreateCasoBody } from '../dtos/create-notificacao.body';
import { CasoNotificado } from '../entities/notificacao';
import { NotificacaoWriteRepository } from '../repositories/notificacao-write.repository';
import { CriarFocoDeCasoNotificado } from './criar-foco-de-caso-notificado';
import { CruzarCasoComFocos } from './cruzar-caso-com-focos';
import { ResolverAgentePorQuadra } from './resolver-agente-por-quadra';
import { ResolverTerritorioPorCoordenada } from './resolver-territorio-por-coordenada';

@Injectable()
export class CreateCaso {
  private readonly logger = new Logger(CreateCaso.name);

  constructor(
    private repository: NotificacaoWriteRepository,
    private cruzarCasoComFocos: CruzarCasoComFocos,
    private criarFocoDeCasoNotificado: CriarFocoDeCasoNotificado,
    private enfileirarScore: EnfileirarScoreImovel,
    private resolverTerritorio: ResolverTerritorioPorCoordenada,
    private resolverAgentePorQuadra: ResolverAgentePorQuadra,
  ) {}

  async execute(
    clienteId: string,
    userId: string | undefined,
    input: CreateCasoBody,
  ): Promise<{
    caso: CasoNotificado;
    territorio: {
      bairroId: string | null;
      bairroNome: string | null;
      quadraId: string | null;
      quadraCodigo: string | null;
    };
    agente: { id: string | null; nome: string | null };
  }> {
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

    // Resolução territorial — do lat/long do endereço para bairro + quadra (PostGIS)
    // e daí o agente territorial responsável. Best-effort: falha aqui NUNCA impede
    // a criação do caso (mesmo padrão dos hooks E.1.1).
    let bairroId: string | null = created.regiaoId ?? null;
    let bairroNome: string | null = null;
    let quadraId: string | null = null;
    let quadraCodigo: string | null = null;
    let agenteId: string | null = null;
    let agenteNome: string | null = null;
    try {
      const territorio = await this.resolverTerritorio.execute({
        clienteId: created.clienteId,
        latitude: created.latitude,
        longitude: created.longitude,
      });
      // Bairro resolvido geoespacialmente tem precedência; se null, mantém a
      // seleção manual da região (created.regiaoId).
      bairroId = territorio.bairroId ?? created.regiaoId ?? null;
      bairroNome = territorio.bairroNome;
      quadraId = territorio.quadraId;
      quadraCodigo = territorio.quadraCodigo;

      if (quadraId) {
        const agente = await this.resolverAgentePorQuadra.execute(
          created.clienteId,
          quadraId,
        );
        agenteId = agente.agenteId;
        agenteNome = agente.agenteNome;
      }

      if (bairroId !== (created.regiaoId ?? null) || quadraId) {
        await this.repository.vincularTerritorio(created.id!, {
          bairroId,
          quadraId,
        });
      }
    } catch (err) {
      this.logger.error(
        `[CreateCaso] Resolução territorial falhou para caso ${created.id}: ${(err as Error).message}`,
      );
    }

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
          bairroId,
          quadraId,
          responsavelId: agenteId,
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
        await this.enfileirarScore.enfileirarPorCaso(
          created.id!,
          created.clienteId,
        );
      } catch (err) {
        this.logger.error(
          `[CreateCaso] Falha ao enfileirar score por caso ${created.id}: ${(err as Error).message}`,
          (err as Error).stack,
        );
      }
    }

    return {
      caso: created,
      territorio: { bairroId, bairroNome, quadraId, quadraCodigo },
      agente: { id: agenteId, nome: agenteNome },
    };
  }
}
