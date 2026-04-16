/**
 * Utilitários compartilhados para operações com focos_risco.
 * Usado por ItemDetailPanel (online) e offlineQueue (drain ao reconectar).
 */

import { api } from '@/services/api';
import { FocoRiscoStatus, StatusAtendimento } from '@/types/database';
import { mapFocoToStatusOperacional, type FocoStatus } from '@/lib/mapStatusOperacional';

// ── Mapeamento de status ───────────────────────────────────────────────────────

/** Mapeia status do foco para o modelo de 3 estados do UI legado. */
export function focoStatusToAtendimento(status: FocoRiscoStatus): StatusAtendimento {
  return mapFocoToStatusOperacional(status as FocoStatus);
}

/** Mapeia StatusAtendimento legado para o status alvo equivalente em focos_risco. */
export function atendimentoToFocoAlvo(
  status: StatusAtendimento,
): FocoRiscoStatus {
  if (status === 'resolvido') return 'resolvido';
  if (status === 'em_atendimento') return 'em_tratamento';
  return 'descartado'; // "cancelar atendimento"
}

// ── State machine traversal ────────────────────────────────────────────────────

/**
 * Retorna a sequência de transições necessárias para ir de statusAtual até alvo.
 * Respeita o fluxo canônico: aguarda_inspecao → em_inspecao → confirmado → em_tratamento → resolvido/descartado.
 * Nota: suspeita → em_triagem é automático via trigger; buildFocoPath não gera caminhos a partir de suspeita.
 */
export function buildFocoPath(
  statusAtual: FocoRiscoStatus,
  alvo: FocoRiscoStatus,
): FocoRiscoStatus[] {
  if (alvo === 'resolvido') {
    if (statusAtual === 'aguarda_inspecao') return ['em_inspecao', 'confirmado', 'em_tratamento', 'resolvido'];
    if (statusAtual === 'em_inspecao')      return ['confirmado', 'em_tratamento', 'resolvido'];
    if (statusAtual === 'confirmado')       return ['em_tratamento', 'resolvido'];
    if (statusAtual === 'em_tratamento')    return ['resolvido'];
  }
  if (alvo === 'em_tratamento') {
    if (statusAtual === 'aguarda_inspecao') return ['em_inspecao', 'confirmado', 'em_tratamento'];
    if (statusAtual === 'em_inspecao')      return ['confirmado', 'em_tratamento'];
    if (statusAtual === 'confirmado')       return ['em_tratamento'];
  }
  if (alvo === 'confirmado') {
    if (statusAtual === 'aguarda_inspecao') return ['em_inspecao', 'confirmado'];
    if (statusAtual === 'em_inspecao')      return ['confirmado'];
  }
  if (alvo === 'em_inspecao') {
    if (statusAtual === 'aguarda_inspecao') return ['em_inspecao'];
  }
  if (alvo === 'descartado') {
    // Apenas estados operacionais do agente permitem descarte.
    // em_triagem: supervisor não descarta + agente não opera nesse estado.
    // confirmado: state machine só permite confirmado → em_tratamento.
    if (['aguarda_inspecao', 'em_inspecao', 'em_tratamento'].includes(statusAtual)) return ['descartado'];
  }
  return [];
}

/**
 * Avança o foco pelo state machine até atingir o status alvo.
 * Executa as transições intermediárias necessárias em sequência.
 */
export async function avancarFocoAte(
  focoId: string,
  statusAtual: FocoRiscoStatus,
  alvo: FocoRiscoStatus,
  motivo?: string | null,
): Promise<void> {
  const path = buildFocoPath(statusAtual, alvo);
  for (const s of path) {
    // eslint-disable-next-line no-await-in-loop
    await api.focosRisco.transicionar(focoId, s, s === alvo ? (motivo ?? undefined) : undefined);
  }
}
