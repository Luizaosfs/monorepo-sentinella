import { baseAuditToHttp } from '@shared/view-model/base-audit';

import {
  FocoRisco,
  FocoRiscoHistorico,
  TRANSICOES_VALIDAS,
} from '../entities/foco-risco';

import type { FocoConsolidacaoHttp } from './foco-consolidacao';
import type { FocoSlaSnapshotHttp } from './foco-sla-snapshot';

export class FocoRiscoViewModel {
  static historicoToHttp(h: FocoRiscoHistorico) {
    return {
      id: h.id,
      focoRiscoId: h.focoRiscoId,
      clienteId: h.clienteId,
      statusAnterior: h.statusAnterior,
      statusNovo: h.statusNovo,
      alteradoPor: h.alteradoPor,
      alteradoEm: h.alteradoEm,
      tipoEvento: h.tipoEvento,
      classificacaoAnterior: h.classificacaoAnterior,
      classificacaoNova: h.classificacaoNova,
      motivo: h.motivo,
    };
  }

  static toHttp(
    foco: FocoRisco,
    sla?: FocoSlaSnapshotHttp,
    consolidacao?: FocoConsolidacaoHttp,
  ) {
    return {
      id: foco.id,
      clienteId: foco.clienteId,
      imovelId: foco.imovelId,
      regiaoId: foco.regiaoId,
      origemTipo: foco.origemTipo,
      origemLevantamentoItemId: foco.origemLevantamentoItemId,
      origemVistoriaId: foco.origemVistoriaId,
      status: foco.status,
      prioridade: foco.prioridade,
      prioridadeOriginalAntesCaso: foco.prioridadeOriginalAntesCaso,
      ciclo: foco.ciclo,
      latitude: foco.latitude,
      longitude: foco.longitude,
      enderecoNormalizado: foco.enderecoNormalizado,
      suspeitaEm: foco.suspeitaEm,
      dadosMinimosEm: foco.dadosMinimosEm,
      inspecaoEm: foco.inspecaoEm,
      confirmadoEm: foco.confirmadoEm,
      resolvidoEm: foco.resolvidoEm,
      responsavelId: foco.responsavelId,
      desfecho: foco.desfecho,
      focoAnteriorId: foco.focoAnteriorId,
      casosIds: foco.casosIds,
      observacao: foco.observacao,
      classificacaoInicial: foco.classificacaoInicial,
      scorePrioridade: foco.scorePrioridade,
      codigoFoco: foco.codigoFoco,
      // JSON operacional/analítico; classificação atual legada pode existir em payload; coluna canônica de rótulo é classificacaoInicial.
      // prioridade + scorePrioridade: operacionais no foco; prioridadeFinal analítica vem em `consolidacao` (vistorias).
      payload: foco.payload,
      ...(consolidacao
        ? {
            consolidacao: {
              ...consolidacao,
              consolidadoEm: consolidacao.consolidadoEm ?? null,
            },
          }
        : {}),
      createdAt: foco.createdAt,
      updatedAt: foco.updatedAt,
      ...baseAuditToHttp(foco),
      historico: foco.historico?.map(FocoRiscoViewModel.historicoToHttp),
      // Derivado da máquina de estados (não é coluna).
      transicoesDisponiveis:
        foco.historico !== undefined
          ? (TRANSICOES_VALIDAS[foco.status] ?? [])
          : undefined,
      ...(sla ? { sla } : {}),
    };
  }
}
