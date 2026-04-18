/**
 * Instrumentação do piloto de IA/operação.
 *
 * logEvento() é fire-and-forget: nunca lança exceção, nunca bloqueia o fluxo.
 * Chame sem await sempre que possível.
 */
import { http } from '@sentinella/api-client';

export type PilotoEventoTipo =
  // Resumo IA
  | 'resumo_visualizado'
  | 'resumo_gerado'
  | 'resumo_refresh_manual'
  // Rota do agente
  | 'rota_otimizada'
  | 'rota_revertida'
  // Operação de focos — agente
  | 'foco_visualizado'
  | 'foco_iniciado'
  | 'foco_inspecao_iniciada'
  | 'foco_confirmado'
  | 'foco_descartado'
  | 'foco_tratamento_iniciado'
  | 'foco_resolvido'
  | 'foco_alta_prioridade_listado'
  | 'foco_critico_exibido'
  // Triagem — supervisor
  | 'triagem_aberta'
  | 'triagem_modo_alternado'
  | 'triagem_distribuicao_individual'
  | 'triagem_distribuicao_lote'
  | 'despacho_lote'
  // Dashboard
  | 'dashboard_aberto';

export interface PilotoEventoPayload {
  foco_id?: string;
  score?: number;
  imoveis_count?: number;
  status?: string;
  prioridade?: string;
  [key: string]: unknown;
}

/**
 * Registra um evento de uso do piloto de IA/operação.
 * Fire-and-forget — nunca lança, nunca bloqueia.
 *
 * @example
 * logEvento('rota_otimizada', clienteId, { imoveis_count: 8 });
 */
export function logEvento(
  tipo: PilotoEventoTipo,
  clienteId: string | null | undefined,
  payload: PilotoEventoPayload = {},
): void {
  if (!clienteId) return;

  http.post('/piloto/eventos', { tipo, cliente_id: clienteId, payload }).catch(() => {
    // fire-and-forget — resultado ignorado intencionalmente
  });
}
