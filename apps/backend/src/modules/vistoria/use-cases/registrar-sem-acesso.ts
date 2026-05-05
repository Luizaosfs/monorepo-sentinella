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

/** Dias úteis a aguardar por motivo antes de nova tentativa (sem_previsao não agenda). */
const DIAS_ESPERA: Partial<Record<MotivoSemAcesso, number>> = {
  fechado:   1,
  recusa:    2,
  desocupado: 3,
};

/**
 * Incremento de score por motivo.
 * PENDÊNCIA TÉCNICA: RecalcularScorePrioridadeFoco sobrescreve este valor na
 * próxima transição de status (calcularScorePrioridadeFoco não inclui
 * tentativas_sem_acesso como input). O incremento persiste até a próxima
 * transição via TransicionarFocoRisco. Considerar adicionar tentativas_sem_acesso
 * a ScoreInputs em iteração futura.
 */
const SCORE_DELTA: Record<MotivoSemAcesso, number> = {
  recusa:      10,
  fechado:     5,
  desocupado:  0,
  sem_previsao: 5,
};

function calcularProximaTentativa(motivo: MotivoSemAcesso): Date | null {
  const dias = DIAS_ESPERA[motivo];
  if (!dias) return null; // sem_previsao não agenda data

  const data = new Date();
  let adicionados = 0;
  while (adicionados < dias) {
    data.setDate(data.getDate() + 1);
    const diaSemana = data.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) adicionados++;
  }
  return data;
}

function calcularScoreDelta(motivo: MotivoSemAcesso, tentativa: number): number {
  let delta = SCORE_DELTA[motivo];
  // Fechado: só aplica incremento a partir da 2ª tentativa
  if (motivo === 'fechado' && tentativa < 2) delta = 0;
  // 3ª tentativa: acréscimo adicional independente do motivo
  if (tentativa >= MAX_TENTATIVAS) delta += 10;
  return delta;
}

function montarMotivoHistorico(
  motivo: MotivoSemAcesso,
  tentativa: number,
  proximaData: Date | null,
  observacao?: string,
): string {
  const proximaStr = proximaData
    ? ` Próxima tentativa sugerida: ${proximaData.toLocaleDateString('pt-BR')}.`
    : ' Sem previsão de retorno — aguarda decisão do supervisor.';
  const obsStr = observacao ? ` Obs: ${observacao}` : '';
  return `Sem acesso (${motivo}). Tentativa ${tentativa}/${MAX_TENTATIVAS}.${proximaStr}${obsStr}`;
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

    const proximaTentativa = calcularProximaTentativa(input.motivo);

    vistoria.acessoRealizado = false;
    vistoria.motivoSemAcesso = input.motivo;
    vistoria.proximoHorarioSugerido = input.proximoHorarioSugerido;
    vistoria.observacaoAcesso = input.observacao;
    vistoria.proximaTentativaSugerida = proximaTentativa ?? undefined;

    await this.vistoriaWriteRepository.save(vistoria);

    const focoId = input.focoRiscoId ?? vistoria.focoRiscoId;
    if (!focoId) {
      return { vistoria, escaladoSupervisor: false, tentativaNumero: 1, proximaTentativa };
    }

    let escaladoSupervisor = false;
    let tentativaNumero = 1;

    try {
      const foco = await this.focoRiscoReadRepository.findById(focoId, clienteId);
      if (!foco) {
        this.logger.warn(`Foco ${focoId} não encontrado ao registrar sem-acesso da vistoria ${vistoriaId}`);
        return { vistoria, escaladoSupervisor: false, tentativaNumero: 1, proximaTentativa };
      }

      if (foco.status !== 'em_inspecao') {
        this.logger.warn(`Foco ${focoId} não está em_inspecao (status=${foco.status}), pulando transição`);
        return { vistoria, escaladoSupervisor: false, tentativaNumero: 1, proximaTentativa };
      }

      tentativaNumero = foco.tentativasSemAcesso + 1;
      foco.tentativasSemAcesso = tentativaNumero;

      // sem_previsao: vai para aguardando_nova_tentativa (visível nos filtros/cards)
      // mas sem data de próxima tentativa e marcado para decisão do supervisor.
      // Mesma lógica aplica quando MAX_TENTATIVAS é atingido.
      const devEscalar = tentativaNumero >= MAX_TENTATIVAS || input.motivo === 'sem_previsao';
      if (devEscalar) {
        foco.pendentDecisaoSupervisor = true;
        escaladoSupervisor = true;
      }

      // Todos os motivos transitam para aguardando_nova_tentativa para manter
      // visibilidade operacional. sem_previsao também usa este status mas com
      // pendente_decisao_supervisor=true e sem data de retorno calculada.
      foco.status = 'aguardando_nova_tentativa';

      // Score: aplica incremento controlado (cap 100).
      // PENDÊNCIA: será sobrescrito por RecalcularScorePrioridadeFoco na próxima
      // transição via TransicionarFocoRisco, pois calcularScorePrioridadeFoco
      // não recebe tentativas_sem_acesso como input.
      const delta = calcularScoreDelta(input.motivo, tentativaNumero);
      if (delta > 0) {
        const novoScore = Math.min(100, foco.scorePrioridade + delta);
        await this.focoRiscoWriteRepository.updateScorePrioridade(foco.id!, novoScore);
      }

      await this.focoRiscoWriteRepository.save(foco);

      await this.focoRiscoWriteRepository.createHistorico({
        focoRiscoId: foco.id,
        clienteId: foco.clienteId,
        statusAnterior: 'em_inspecao',
        statusNovo: foco.status,
        alteradoPor: user.id,
        motivo: montarMotivoHistorico(input.motivo, tentativaNumero, proximaTentativa, input.observacao),
        tipoEvento: escaladoSupervisor ? 'escalado_supervisor' : 'sem_acesso_registrado',
      });
    } catch (err) {
      this.logger.error(`Erro ao atualizar foco ${focoId} no sem-acesso: ${err}`);
    }

    return { vistoria, escaladoSupervisor, tentativaNumero, proximaTentativa };
  }
}
