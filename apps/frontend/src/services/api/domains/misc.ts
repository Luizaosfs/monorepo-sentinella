import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { type Ret } from '../shared/case-mappers';

export const tags = {
  list: async () => { throw new Error('[sem endpoint NestJS] tags.list'); },
};

export const recorrencias = {
  listAtivasByCliente: async () => { throw new Error('[sem endpoint NestJS] recorrencias.listAtivasByCliente'); },
  countAtivasByCliente: async () => { throw new Error('[sem endpoint NestJS] recorrencias.countAtivasByCliente'); },
  listItensByRecorrencia: async () => { throw new Error('[sem endpoint NestJS] recorrencias.listItensByRecorrencia'); },
};

export const integracoes = {
  revelarChave: (integracaoId: string): Promise<Ret<typeof _sb.integracoes.revelarChave>> =>
    http.get(`/clientes/integracoes/${integracaoId}/api-key`),

  getByCliente: async () => { throw new Error('[sem endpoint NestJS] integracoes.getByCliente'); },
  upsert: async () => { throw new Error('[sem endpoint NestJS] integracoes.upsert'); },
  updateMeta: async () => { throw new Error('[sem endpoint NestJS] integracoes.updateMeta'); },
  testarConexao: async () => { throw new Error('[sem endpoint NestJS] integracoes.testarConexao'); },
};

export const agrupamentos = {
  list: async () => { throw new Error('[sem endpoint NestJS] agrupamentos.list'); },
  create: async () => { throw new Error('[sem endpoint NestJS] agrupamentos.create'); },
  update: async () => { throw new Error('[sem endpoint NestJS] agrupamentos.update'); },
  listClientes: async () => { throw new Error('[sem endpoint NestJS] agrupamentos.listClientes'); },
  addCliente: async () => { throw new Error('[sem endpoint NestJS] agrupamentos.addCliente'); },
  removeCliente: async () => { throw new Error('[sem endpoint NestJS] agrupamentos.removeCliente'); },
};

export const map = {
  fullDataByCliente: async () => { throw new Error('[sem endpoint NestJS] map.fullDataByCliente'); },
  itemStatusesByCliente: async () => { throw new Error('[sem endpoint NestJS] map.itemStatusesByCliente'); },
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
