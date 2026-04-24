import { Injectable, Logger } from '@nestjs/common';

import { ImovelReadRepository } from '../../imovel/repositories/imovel-read.repository';
import { ImovelWriteRepository } from '../../imovel/repositories/imovel-write.repository';
import { Job } from '../../job/entities/job';
import { JobWriteRepository } from '../../job/repositories/job-write.repository';
import { VistoriaReadRepository } from '../repositories/vistoria-read.repository';

const JANELA_DIAS = 90;
const LIMIAR_TENTATIVAS = 3;

export interface AtualizarPerfilImovelInput {
  imovelId: string;
  vistoriaId: string;
  agenteId: string | null | undefined;
  clienteId: string;
}

/**
 * Paridade com fn_atualizar_perfil_imovel (SQL legado, versão R1 — 20260916).
 *
 * Dispara em TODO INSERT/UPDATE de vistoria (não apenas quando acesso_realizado=false),
 * pois uma vistoria COM acesso pode fazer a janela cair abaixo de 3 tentativas e
 * precisar resetar prioridade_drone.
 *
 * 4 branches:
 *  1. >=3 && !eraAtivoDrone → marca historico_recusa + prioridade_drone, enfileira job (1ª ativação)
 *  2. >=3 && eraAtivoDrone  → marca historico_recusa + prioridade_drone, SEM enfileirar job
 *  3. <3  && eraAtivoDrone  → reseta prioridade_drone=false (historico_recusa PERMANECE)
 *  4. <3  && !eraAtivoDrone → no-op (paridade com WHERE prioridade_drone = true do SQL)
 */
@Injectable()
export class AtualizarPerfilImovel {
  private readonly logger = new Logger(AtualizarPerfilImovel.name);

  constructor(
    private imovelRead: ImovelReadRepository,
    private imovelWrite: ImovelWriteRepository,
    private vistoriaRead: VistoriaReadRepository,
    private jobWrite: JobWriteRepository,
  ) {}

  async execute(input: AtualizarPerfilImovelInput): Promise<void> {
    const { imovelId, vistoriaId, agenteId, clienteId } = input;

    const imovel = await this.imovelRead.findById(imovelId, clienteId);
    if (!imovel) {
      this.logger.warn(`[AtualizarPerfilImovel] imovel ${imovelId} não encontrado, skip`);
      return;
    }

    const eraAtivoDrone = imovel.prioridadeDrone ?? false;

    const desde = new Date();
    desde.setDate(desde.getDate() - JANELA_DIAS);
    const semAcesso = await this.vistoriaRead.countSemAcessoPorImovel(imovelId, desde);

    if (semAcesso >= LIMIAR_TENTATIVAS) {
      // Branches 1 e 2: marca como recusante
      await this.imovelWrite.atualizarPerfilDrone(imovelId, clienteId, {
        historicoRecusa: true,
        prioridadeDrone: true,
      });

      // Branch 1 apenas: primeira ativação → enfileira job
      if (!eraAtivoDrone) {
        await this.enqueueJob({ imovelId, vistoriaId, agenteId, clienteId, tentativas: semAcesso });
      }
    } else if (eraAtivoDrone) {
      // Branch 3: janela caiu abaixo do limiar, reseta prioridade
      // historicoRecusa PERMANECE true — registro histórico permanente
      await this.imovelWrite.atualizarPerfilDrone(imovelId, clienteId, {
        prioridadeDrone: false,
      });
    }
    // Branch 4 (<3 && !eraAtivoDrone): no-op implícito
  }

  private async enqueueJob(args: {
    imovelId: string;
    vistoriaId: string;
    agenteId: string | null | undefined;
    clienteId: string;
    tentativas: number;
  }): Promise<void> {
    const job = new Job(
      {
        tipo: 'notif_imovel_prioridade_drone',
        payload: {
          imovel_id: args.imovelId,
          cliente_id: args.clienteId,
          vistoria_id: args.vistoriaId,
          agente_id: args.agenteId ?? null,
          tentativas: args.tentativas,
        },
        status: 'pendente',
        tentativas: 0,
      },
      {},
    );
    await this.jobWrite.create(job);
    this.logger.log(
      `[AtualizarPerfilImovel] Job 'notif_imovel_prioridade_drone' enfileirado para imovel=${args.imovelId}`,
    );
  }
}
