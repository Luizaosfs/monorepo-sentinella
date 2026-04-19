import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToCamel, deepToSnake, type Ret } from '../shared/case-mappers';

export const levantamentos = {
  list: async (
    clienteId: string,
    filtros?: Parameters<typeof _sb.levantamentos.list>[1],
  ): Promise<Ret<typeof _sb.levantamentos.list>> => {
    const raw = await http.get(`/levantamentos${qs({ clienteId, ...filtros })}`);
    return deepToSnake(raw) as Ret<typeof _sb.levantamentos.list>;
  },

  updatePlanejamento: (levId: string, planejamentoId: string): Promise<void> =>
    http.put(`/levantamentos/${levId}`, { planejamentoId }),

  getById: async (id: string): Promise<Ret<typeof _sb.levantamentos.getById>> => {
    const raw = await http.get(`/levantamentos/${id}`);
    return deepToSnake(raw) as Ret<typeof _sb.levantamentos.getById>;
  },

  create: async (payload: Parameters<typeof _sb.levantamentos.create>[0]): Promise<Ret<typeof _sb.levantamentos.create>> => {
    const raw = await http.post('/levantamentos', deepToCamel(payload));
    return deepToSnake(raw) as Ret<typeof _sb.levantamentos.create>;
  },

  update: (id: string, payload: Parameters<typeof _sb.levantamentos.update>[1]): Promise<void> =>
    http.put(`/levantamentos/${id}`, deepToCamel(payload)),

  listByPlanejamento: async (planejamentoId: string): Promise<Ret<typeof _sb.levantamentos.listByPlanejamento>> => {
    const raw = await http.get(`/levantamentos${qs({ planejamentoId })}`);
    return deepToSnake(raw) as Ret<typeof _sb.levantamentos.listByPlanejamento>;
  },

  listConfigFonteMap: async () => { throw new Error('[sem endpoint NestJS] levantamentos.listConfigFonteMap'); },

  delete: (id: string): Promise<void> =>
    http.delete(`/levantamentos/${id}`),
};

export const itens = {
  criarManual: async (
    params: Parameters<typeof _sb.itens.criarManual>[0],
  ): Promise<Ret<typeof _sb.itens.criarManual>> => {
    const raw = await http.post('/levantamentos/item-manual', deepToCamel(params));
    return deepToSnake(raw) as Ret<typeof _sb.itens.criarManual>;
  },

  listByLevantamento: async (levantamentoId: string): Promise<Ret<typeof _sb.itens.listByLevantamento>> => {
    const raw = await http.get(`/levantamentos/${levantamentoId}/itens`);
    return deepToSnake(raw) as Ret<typeof _sb.itens.listByLevantamento>;
  },

  /** @deprecated no-op — colunas removidas na migration 20260711 */
  updateAtendimento: async () => {},

  getById: async (id: string) => {
    const raw = await http.get(`/levantamentos/itens/${id}`);
    return deepToSnake(raw) as Ret<typeof _sb.itens.getById>;
  },

  update: (id: string, payload: Parameters<NonNullable<typeof _sb.itens.update>>[1]): Promise<void> =>
    http.put(`/levantamentos/itens/${id}`, deepToCamel(payload)),

  delete: (id: string): Promise<void> =>
    http.delete(`/levantamentos/itens/${id}`),

  addEvidencia: async (itemId: string, payload: Parameters<NonNullable<typeof _sb.itens.addEvidencia>>[1]) => {
    const raw = await http.post(`/levantamentos/itens/${itemId}/evidencias`, deepToCamel(payload));
    return deepToSnake(raw) as Ret<typeof _sb.itens.addEvidencia>;
  },

  listByFoco: async () => { throw new Error('[sem endpoint NestJS] itens.listByFoco'); },
  listByCliente: async () => { throw new Error('[sem endpoint NestJS] itens.listByCliente'); },
  countStatusAtendimentoByCliente: async () => { throw new Error('[sem endpoint NestJS] itens.countStatusAtendimentoByCliente'); },
  listRecentResolvidosPorCliente: async () => { throw new Error('[sem endpoint NestJS] itens.listRecentResolvidosPorCliente'); },
  listDetecoes: async () => { throw new Error('[sem endpoint NestJS] itens.listDetecoes'); },
  getDetectionBbox: async () => { throw new Error('[sem endpoint NestJS] itens.getDetectionBbox'); },
  registrarCheckin: (itemId: string): Promise<{ ok: boolean; focoId: string | null }> =>
    http.post(`/levantamentos/itens/${itemId}/checkin`, {}),

  listByOperador: (usuarioId: string): Promise<Record<string, unknown>[]> =>
    http.get(`/levantamentos/itens/por-operador${qs({ usuarioId })}`),

  listMapByCliente: (_clienteId: string): Promise<Record<string, unknown>[]> =>
    http.get('/levantamentos/itens/mapa'),
  updateObservacaoAtendimento: async () => { throw new Error('[sem endpoint NestJS] itens.updateObservacaoAtendimento'); },
  listStatusHistorico: async () => { throw new Error('[sem endpoint NestJS] itens.listStatusHistorico'); },
  listByClienteAndPeriod: async () => { throw new Error('[sem endpoint NestJS] itens.listByClienteAndPeriod'); },
};
