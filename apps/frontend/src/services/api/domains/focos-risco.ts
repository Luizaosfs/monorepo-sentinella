import { http } from '@sentinella/api-client';
import { logFallback } from '@/lib/fallbackLogger';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToCamel, deepToSnake, type Ret } from '../shared/case-mappers';

export const focosRisco = {
  /** Lista focos paginados com filtros (page, pageSize, status, prioridade…). */
  list: async (
    clienteId: string,
    filtros?: Parameters<typeof _sb.focosRisco.list>[1],
  ): Promise<Ret<typeof _sb.focosRisco.list>> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any = await http.get(`/focos-risco${qs({ clienteId, ...filtros })}`);
    // Backend paginado retorna { items, pagination } camelCase — adaptar para shape Supabase { data, count } snake_case
    if (raw && 'items' in raw) {
      return { data: deepToSnake(raw.items), count: raw.pagination?.count ?? raw.items.length, error: null } as any;
    }
    return deepToSnake(raw);
  },

  /** Contagens agregadas para fila de triagem (mesmos filtros, sem paginação). */
  contagemTriagemFila: async (
    clienteId: string,
    filtros?: Parameters<typeof _sb.focosRisco.contagemTriagemFila>[1],
  ): Promise<Ret<typeof _sb.focosRisco.contagemTriagemFila>> => {
    try {
      return await http.get(`/focos-risco/contagem-triagem${qs({ clienteId, ...filtros })}`);
    } catch (err) {
      logFallback('focosRisco', 'contagemTriagemFila', err, '/focos-risco/contagem-triagem');
      return _sb.focosRisco.contagemTriagemFila(clienteId, filtros);
    }
  },

  /** Contagem de focos agrupados por status (para KPI cards). */
  contagemPorStatus: async (clienteId: string): Promise<Record<string, number>> => {
    try {
      return await http.get(`/focos-risco/contagem-por-status${qs({ clienteId })}`);
    } catch (err) {
      logFallback('focosRisco', 'contagemPorStatus', err, '/focos-risco/contagem-por-status');
      return _sb.focosRisco.contagemPorStatus(clienteId);
    }
  },

  /** Foco ativo por ID (view v_focos_risco_ativos). Fallback Supabase: shape estendido. */
  getAtivoById: async (id: string): Promise<Ret<typeof _sb.focosRisco.getAtivoById>> => {
    try {
      return deepToSnake(await http.get(`/focos-risco/${id}/ativo`)) as any;
    } catch (err) {
      logFallback('focosRisco', 'getAtivoById', err, `/focos-risco/${id}/ativo`);
      return _sb.focosRisco.getAtivoById(id);
    }
  },

  /** Foco por ID incluindo terminais (v_focos_risco_todos). */
  getPorId: async (id: string): Promise<Ret<typeof _sb.focosRisco.getPorId>> =>
    deepToSnake(await http.get(`/focos-risco/${id}`)) as any,

  /** Foco da tabela base por ID. */
  getById: async (id: string): Promise<Ret<typeof _sb.focosRisco.getById>> =>
    deepToSnake(await http.get(`/focos-risco/${id}`)) as any,

  /** Foco com histórico de transições. Fallback Supabase: shape { foco, historico[] }. */
  get: async (id: string): Promise<Ret<typeof _sb.focosRisco.get>> => {
    try {
      return await http.get(`/focos-risco/${id}/detalhes`);
    } catch (err) {
      logFallback('focosRisco', 'get', err, `/focos-risco/${id}/detalhes`);
      return _sb.focosRisco.get(id);
    }
  },

  /** Histórico de transições de um foco, ordem cronológica. */
  historico: async (focoId: string): Promise<Ret<typeof _sb.focosRisco.historico>> => {
    try {
      return deepToSnake(await http.get(`/focos-risco/${focoId}/historico`)) as any;
    } catch (err) {
      logFallback('focosRisco', 'historico', err, `/focos-risco/${focoId}/historico`);
      return _sb.focosRisco.historico(focoId);
    }
  },

  /** Timeline unificada (estados + vistorias + SLA + casos). Fallback Supabase: v_foco_risco_timeline. */
  timeline: async (focoId: string): Promise<Ret<typeof _sb.focosRisco.timeline>> => {
    try {
      return await http.get(`/focos-risco/${focoId}/timeline`);
    } catch (err) {
      logFallback('focosRisco', 'timeline', err, `/focos-risco/${focoId}/timeline`);
      return _sb.focosRisco.timeline(focoId);
    }
  },

  /** Cria foco manualmente (origem_tipo='manual'). */
  criar: (
    payload: Parameters<typeof _sb.focosRisco.criar>[0],
  ): Promise<Ret<typeof _sb.focosRisco.criar>> =>
    http.post('/focos-risco', payload),

  /** Transiciona estado via backend (state machine validada no UseCase). */
  transicionar: (
    focoId: string,
    statusNovo: Parameters<typeof _sb.focosRisco.transicionar>[1],
    motivo?: string,
    responsavelId?: string,
  ): Promise<Ret<typeof _sb.focosRisco.transicionar>> =>
    http.post(`/focos-risco/${focoId}/transicionar`, { statusNovo, motivo, responsavelId }),

  /** Distribui foco a um agente (em_triagem → aguarda_inspecao ou reatribuição). */
  atribuirAgente: (focoId: string, agenteId: string, motivo?: string): Promise<void> =>
    http.patch(`/focos-risco/${focoId}/atribuir-agente`, { agenteId, motivo }),

  /** Distribui múltiplos focos a um agente em lote. */
  atribuirAgenteLote: (
    focoIds: string[],
    agenteId: string,
    motivo?: string,
  ): Promise<{ atribuidos: number; ignorados: number }> =>
    http.post('/focos-risco/atribuir-agente-lote', { focoIds, agenteId, motivo }),

  /** Agrupamento territorial. Fallback Supabase: v_focos_risco_agrupados (shape complexo). */
  agrupados: async (clienteId: string): Promise<Ret<typeof _sb.focosRisco.agrupados>> => {
    try {
      return await http.get(`/focos-risco/agrupados${qs({ clienteId })}`);
    } catch (err) {
      logFallback('focosRisco', 'agrupados', err, '/focos-risco/agrupados');
      return _sb.focosRisco.agrupados(clienteId);
    }
  },

  /** Drill-down de grupo: focos por lista de IDs. Fallback Supabase: shape FocoRiscoAtivo estendido. */
  listByIds: async (ids: string[]): Promise<Ret<typeof _sb.focosRisco.listByIds>> => {
    try {
      return await http.get(`/focos-risco/by-ids${qs({ ids })}`);
    } catch (err) {
      logFallback('focosRisco', 'listByIds', err, '/focos-risco/by-ids');
      return _sb.focosRisco.listByIds(ids);
    }
  },

  /** Altera classificação inicial (registra no historico). */
  atualizarClassificacao: (
    focoId: string,
    classificacao: Parameters<typeof _sb.focosRisco.atualizarClassificacao>[1],
  ): Promise<Ret<typeof _sb.focosRisco.atualizarClassificacao>> =>
    http.patch(`/focos-risco/${focoId}/classificacao`, { classificacao }),

  /** Atualiza metadados não-status (responsavel_id, desfecho). */
  update: async (
    id: string,
    payload: Parameters<typeof _sb.focosRisco.update>[1],
  ): Promise<void> => {
    try {
      await http.patch(`/focos-risco/${id}`, payload);
    } catch (err) {
      logFallback('focosRisco', 'update', err, `/focos-risco/${id}`);
      return _sb.focosRisco.update(id, payload);
    }
  },

  /** Vincula imóvel a foco (não é transição de status). */
  vincularImovel: async (focoId: string, imovelId: string): Promise<void> => {
    try {
      await http.patch(`/focos-risco/${focoId}`, { imovel_id: imovelId });
    } catch (err) {
      logFallback('focosRisco', 'vincularImovel', err, `/focos-risco/${focoId}`);
      return _sb.focosRisco.vincularImovel(focoId, imovelId);
    }
  },

  // Métodos ainda via Supabase (views analíticas/RPCs sem endpoint NestJS)
  analytics: _sb.focosRisco.analytics.bind(_sb.focosRisco),

  /** GET /dashboard/resumo-regional?clienteId&ciclo&de&ate */
  resumoRegional: async (...args: Parameters<typeof _sb.focosRisco.resumoRegional>): Promise<Ret<typeof _sb.focosRisco.resumoRegional>> => {
    try {
      const [clienteId, ciclo, de, ate] = args as [string, number?, string?, string?];
      return await http.get(`/dashboard/resumo-regional${qs({ clienteId, ciclo, de, ate })}`);
    } catch { return _sb.focosRisco.resumoRegional(...args); }
  },
  byLevantamentoItem: _sb.focosRisco.byLevantamentoItem.bind(_sb.focosRisco),
  listByImovel: _sb.focosRisco.listByImovel.bind(_sb.focosRisco),
};
