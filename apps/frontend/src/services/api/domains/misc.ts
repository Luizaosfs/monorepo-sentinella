import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToCamel, deepToSnake, type Ret } from '../shared/case-mappers';

export const tags = {
  list: async () => {
    const raw = await http.get('/tags');
    return deepToSnake(raw) as Ret<typeof _sb.tags.list>;
  },
};

export const recorrencias = {
  listAtivasByCliente: async () => { throw new Error('[sem endpoint NestJS] recorrencias.listAtivasByCliente'); },
  countAtivasByCliente: async () => { throw new Error('[sem endpoint NestJS] recorrencias.countAtivasByCliente'); },
  listItensByRecorrencia: async () => { throw new Error('[sem endpoint NestJS] recorrencias.listItensByRecorrencia'); },
};

export const integracoes = {
  revelarChave: (integracaoId: string): Promise<Ret<typeof _sb.integracoes.revelarChave>> =>
    http.get(`/clientes/integracoes/${integracaoId}/api-key`),

  getByCliente: async (_clienteId?: string) => {
    const raw = await http.get('/clientes/integracoes');
    return deepToSnake(raw) as Ret<typeof _sb.integracoes.getByCliente>;
  },
  upsert: async (...args: Parameters<typeof _sb.integracoes.upsert>) => {
    const raw = await http.post('/clientes/integracoes', deepToCamel(args[0] as Record<string, unknown>));
    return deepToSnake(raw) as Ret<typeof _sb.integracoes.upsert>;
  },
  updateMeta: async (...args: Parameters<typeof _sb.integracoes.updateMeta>) => {
    const [id, payload] = args as [string, Record<string, unknown>];
    const raw = await http.put(`/clientes/integracoes/${id}/meta`, deepToCamel(payload));
    return deepToSnake(raw) as Ret<typeof _sb.integracoes.updateMeta>;
  },
  testarConexao: async (_clienteId?: string): Promise<Ret<typeof _sb.integracoes.testarConexao>> =>
    http.post('/clientes/integracoes/testar', {}),
};

export const agrupamentos = {
  list: async () => {
    const raw = await http.get('/agrupamentos');
    return deepToSnake(raw) as Ret<typeof _sb.agrupamentos.list>;
  },
  create: async (...args: Parameters<typeof _sb.agrupamentos.create>) => {
    const raw = await http.post('/agrupamentos', deepToCamel(args[0] as Record<string, unknown>));
    return deepToSnake(raw) as Ret<typeof _sb.agrupamentos.create>;
  },
  update: async (...args: Parameters<typeof _sb.agrupamentos.update>) => {
    const [id, payload] = args as [string, Record<string, unknown>];
    const raw = await http.put(`/agrupamentos/${id}`, deepToCamel(payload));
    return deepToSnake(raw) as Ret<typeof _sb.agrupamentos.update>;
  },
  listClientes: async (...args: Parameters<typeof _sb.agrupamentos.listClientes>) => {
    const raw = await http.get(`/agrupamentos/${args[0]}/clientes`);
    return deepToSnake(raw) as Ret<typeof _sb.agrupamentos.listClientes>;
  },
  addCliente: async (...args: Parameters<typeof _sb.agrupamentos.addCliente>) => {
    const [agrupamentoId, clienteId] = args as [string, string];
    const raw = await http.post(`/agrupamentos/${agrupamentoId}/clientes`, { clienteId });
    return deepToSnake(raw) as Ret<typeof _sb.agrupamentos.addCliente>;
  },
  removeCliente: async (...args: Parameters<typeof _sb.agrupamentos.removeCliente>) => {
    const [agrupamentoId, clienteId] = args as [string, string];
    await http.delete(`/agrupamentos/${agrupamentoId}/clientes/${clienteId}`);
  },
};

export const map = {
  fullDataByCliente: (clienteId: string) =>
    http.get(`/levantamentos/map/full-data${qs({ clienteId })}`),
  itemStatusesByCliente: (clienteId: string) =>
    http.get(`/levantamentos/map/item-statuses${qs({ clienteId })}`),
};

export const evidenciasItem = {
  add: (...args: Parameters<typeof _sb.evidenciasItem.add>): Promise<Ret<typeof _sb.evidenciasItem.add>> => {
    const [itemId, url, legenda] = args as [string, string, string?];
    return http.post(`/levantamentos/itens/${itemId}/evidencias`, { url, legenda });
  },
};

export const levantamentoItemEvidencias = {
  listByItem: (itemId: string): Promise<Ret<typeof _sb.levantamentoItemEvidencias.listByItem>> =>
    http.get(`/levantamentos/itens/${itemId}/evidencias`),
};
