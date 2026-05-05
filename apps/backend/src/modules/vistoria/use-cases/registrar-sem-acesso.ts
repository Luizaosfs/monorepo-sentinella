import { Inject, Injectable, Logger } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope } from '@shared/security/access-scope.helpers';
import type { AuthenticatedUser } from 'src/guards/auth.guard';

import { FocoRiscoReadRepository } from '../../foco-risco/repositories/foco-risco-read.repository';
import { FocoRiscoWriteRepository } from '../../foco-risco/repositories/foco-risco-write.repository';
import { VistoriaException } from '../errors/vistoria.exception';
import { VistoriaReadRepository } from '../repositories/vistoria-read.repository';
import { VistoriaWriteRepository } from '../repositories/vistoria-write.repository';
import { MotivoSemAcesso, RegistrarSemAcessoInput } from '../dtos/registrar-sem-acesso.body';

const MAX_TENTATIVAS = 3;

/** Dias úteis a aguardar por motivo antes de nova tentativa. */
const DIAS_ESPERA: Record<MotivoSemAcesso, number> = {
  fechado: 1,
  recusa: 2,
  desocupado: 3,
  sem_previsao: 5,
};

function proximaTentativaDate(motivo: MotivoSemAcesso): Date {
  const dias = DIAS_ESPERA[motivo];
  const data = new Date();
  let adicionados = 0;
  while (adicionados < dias) {
    data.setDate(data.getDate() + 1);
    const diaSemana = data.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) adicionados++;
  }
  return data;
}

@Injectable()
export class RegistrarSemAcessoVistoria {
  private readonly logger = new Logger(RegistrarSemAcessoVistoria.name);

  constructor(
    private vistoriaReadRepository: VistoriaReadRepository,
    private vistoriaWriteRepository: VistoriaWriteRepository,
    private focoRiscoReadRepository: FocoRiscoReadRepository,
    private focoRiscoWriteRepository: FocoRiscoWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(vistoriaId: string, input: RegistrarSemAcessoInput) {
    const user = this.req['user'] as AuthenticatedUser | undefined;
    if (!user) throw VistoriaException.semPermissao();

    const scope = getAccessScope(this.req);
    const clienteId = scope.tenantId;

    const vistoria = await this.vistoriaReadRepository.findById(vistoriaId, clienteId);
    if (!vistoria) throw VistoriaException.notFound();

    // Registrar tentativa na vistoria
    vistoria.acessoRealizado = false;
    vistoria.motivoSemAcesso = input.motivo;
    vistoria.proximoHorarioSugerido = input.proximoHorarioSugerido;
    vistoria.observacaoAcesso = input.observacao;
    vistoria.proximaTentativaSugerida = proximaTentativaDate(input.motivo);
    vistoria.status = 'sem_acesso';

    await this.vistoriaWriteRepository.save(vistoria);

    // Atualizar foco de risco vinculado (se existir)
    const focoId = input.focoRiscoId ?? vistoria.focoRiscoId;
    if (!focoId) {
      return { vistoria, escaladoSupervisor: false };
    }

    let escaladoSupervisor = false;

    try {
      const foco = await this.focoRiscoReadRepository.findById(focoId, clienteId);
      if (!foco) {
        this.logger.warn(`Foco ${focoId} não encontrado ao registrar sem-acesso da vistoria ${vistoriaId}`);
        return { vistoria, escaladoSupervisor: false };
      }

      if (foco.status !== 'em_inspecao') {
        this.logger.warn(`Foco ${focoId} não está em_inspecao (status=${foco.status}), pulando transição`);
        return { vistoria, escaladoSupervisor: false };
      }

      const novasTentativas = foco.tentativasSemAcesso + 1;
      foco.tentativasSemAcesso = novasTentativas;

      if (novasTentativas >= MAX_TENTATIVAS) {
        foco.pendentDecisaoSupervisor = true;
        escaladoSupervisor = true;
        // Foco permanece em_inspecao aguardando decisão do supervisor
      } else {
        foco.status = 'aguardando_nova_tentativa';
      }

      const statusAnterior = 'em_inspecao';
      await this.focoRiscoWriteRepository.save(foco);

      await this.focoRiscoWriteRepository.createHistorico({
        focoRiscoId: foco.id,
        clienteId: foco.clienteId,
        statusAnterior,
        statusNovo: foco.status,
        alteradoPor: user.id,
        motivo: `Sem acesso: ${input.motivo}. Tentativa ${novasTentativas}/${MAX_TENTATIVAS}.${input.observacao ? ` ${input.observacao}` : ''}`,
        tipoEvento: escaladoSupervisor ? 'escalado_supervisor' : 'sem_acesso_registrado',
      });
    } catch (err) {
      this.logger.error(`Erro ao atualizar foco ${focoId} no sem-acesso: ${err}`);
    }

    return { vistoria, escaladoSupervisor };
  }
}
