import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToCamel, deepToSnake, type Ret } from '../shared/case-mappers';

export const focosRisco = {
  list: async (
    clienteId: string,
    filtros?: Parameters<typeof _sb.focosRisco.list>[1],
  ): Promise<Ret<typeof _sb.focosRisco.list>> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any = await http.get(`/focos-risco${qs({ clienteId, ...filtros })}`);
    if (raw && 'items' in raw) {
      return { data: deepToSnake(raw.items), count: raw.pagination?.count ?? raw.items.length, error: null } as any;
    }
    return deepToSnake(raw);
  },

  contagemTriagemFila: (
    clienteId: string,
    filtros?: Parameters<typeof _sb.focosRisco.contagemTriagemFila>[1],
  ): Promise<Ret<typeof _sb.focosRisco.contagemTriagemFila>> =>
    http.get(`/focos-risco/contagem-triagem${qs({ clienteId, ...filtros })}`),

  contagemPorStatus: (clienteId: string): Promise<Record<string, number>> =>
    http.get(`/focos-risco/contagem-por-status${qs({ clienteId })}`),

  getAtivoById: async (id: string): Promise<Ret<typeof _sb.focosRisco.getAtivoById>> =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deepToSnake(await http.get(`/focos-risco/${id}/ativo`)) as any,

  getPorId: async (id: string): Promise<Ret<typeof _sb.focosRisco.getPorId>> =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deepToSnake(await http.get(`/focos-risco/${id}`)) as any,

  getById: async (id: string): Promise<Ret<typeof _sb.focosRisco.getById>> =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deepToSnake(await http.get(`/focos-risco/${id}`)) as any,

  get: (id: string): Promise<Ret<typeof _sb.focosRisco.get>> =>
    http.get(`/focos-risco/${id}/detalhes`),

  historico: async (focoId: string): Promise<Ret<typeof _sb.focosRisco.historico>> =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deepToSnake(await http.get(`/focos-risco/${focoId}/historico`)) as any,

  timeline: (focoId: string): Promise<Ret<typeof _sb.focosRisco.timeline>> =>
    http.get(`/focos-risco/${focoId}/timeline`),

  criar: (
    payload: Parameters<typeof _sb.focosRisco.criar>[0],
  ): Promise<Ret<typeof _sb.focosRisco.criar>> =>
    http.post('/focos-risco', payload),

  transicionar: (
    focoId: string,
    statusNovo: Parameters<typeof _sb.focosRisco.transicionar>[1],
    motivo?: string,
    responsavelId?: string,
  ): Promise<Ret<typeof _sb.focosRisco.transicionar>> =>
    http.post(`/focos-risco/${focoId}/transicionar`, { statusNovo, motivo, responsavelId }),

  iniciarInspecao: (focoId: string, observacao?: string): Promise<unknown> =>
    http.patch(`/focos-risco/${focoId}/iniciar-inspecao`, { observacao }),

  atribuirAgente: (focoId: string, agenteId: string, motivo?: string): Promise<void> =>
    http.patch(`/focos-risco/${focoId}/atribuir-agente`, { agenteId, motivo }),

  atribuirAgenteLote: (
    focoIds: string[],
    agenteId: string,
    motivo?: string,
  ): Promise<{ atribuidos: number; ignorados: number }> =>
    http.post('/focos-risco/atribuir-agente-lote', { focoIds, agenteId, motivo }),

  agrupados: (clienteId: string): Promise<Ret<typeof _sb.focosRisco.agrupados>> =>
    http.get(`/focos-risco/agrupados${qs({ clienteId })}`),

  listByIds: (ids: string[]): Promise<Ret<typeof _sb.focosRisco.listByIds>> =>
    http.get(`/focos-risco/by-ids${qs({ ids })}`),

  atualizarClassificacao: (
    focoId: string,
    classificacao: Parameters<typeof _sb.focosRisco.atualizarClassificacao>[1],
  ): Promise<Ret<typeof _sb.focosRisco.atualizarClassificacao>> =>
    http.patch(`/focos-risco/${focoId}/classificacao`, { classificacao }),

  update: (
    id: string,
    payload: Parameters<typeof _sb.focosRisco.update>[1],
  ): Promise<void> =>
    http.patch(`/focos-risco/${id}`, payload),

  vincularImovel: (focoId: string, imovelId: string): Promise<void> =>
    http.patch(`/focos-risco/${focoId}`, { imovel_id: imovelId }),

  analytics: (): Promise<unknown> => http.get('/focos-risco/analytics'),

  resumoRegional: async (...args: Parameters<typeof _sb.focosRisco.resumoRegional>): Promise<Ret<typeof _sb.focosRisco.resumoRegional>> => {
    const [clienteId, ciclo, de, ate] = args as [string, number?, string?, string?];
    return http.get(`/dashboard/resumo-regional${qs({ clienteId, ciclo, de, ate })}`);
  },
  byLevantamentoItem: (itemId: string): Promise<unknown> =>
    http.get(`/focos-risco/by-levantamento-item${qs({ itemId })}`),
  listByImovel: (imovelId: string): Promise<unknown> =>
    http.get(`/focos-risco/by-imovel${qs({ imovelId })}`),
};
