import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { type Ret } from '../shared/case-mappers';

// @fallback tabela tags — sem endpoint NestJS
export const tags = {
  list: _sb.tags.list.bind(_sb.tags),
};

// @fallback focos_risco agrupados — sem endpoint NestJS
export const recorrencias = {
  listAtivasByCliente: _sb.recorrencias.listAtivasByCliente.bind(_sb.recorrencias),
  countAtivasByCliente: _sb.recorrencias.countAtivasByCliente.bind(_sb.recorrencias),
  listItensByRecorrencia: _sb.recorrencias.listItensByRecorrencia.bind(_sb.recorrencias),
};

export const integracoes = {
  /** HTTP GET /clientes/integracoes/:id/api-key — revela chave de integração. */
  revelarChave: async (integracaoId: string): Promise<Ret<typeof _sb.integracoes.revelarChave>> => {
    try { return await http.get(`/clientes/integracoes/${integracaoId}/api-key`); }
    catch { return _sb.integracoes.revelarChave(integracaoId); }
  },
  /** @fallback tabela cliente_integracoes — sem endpoint NestJS completo. */
  getByCliente: _sb.integracoes.getByCliente.bind(_sb.integracoes),
  upsert: _sb.integracoes.upsert.bind(_sb.integracoes),
  updateMeta: _sb.integracoes.updateMeta.bind(_sb.integracoes),
  testarConexao: _sb.integracoes.testarConexao.bind(_sb.integracoes),
};

// @fallback tabela agrupamento_regional — sem endpoint NestJS
export const agrupamentos = {
  list: _sb.agrupamentos.list.bind(_sb.agrupamentos),
  create: _sb.agrupamentos.create.bind(_sb.agrupamentos),
  update: _sb.agrupamentos.update.bind(_sb.agrupamentos),
  listClientes: _sb.agrupamentos.listClientes.bind(_sb.agrupamentos),
  addCliente: _sb.agrupamentos.addCliente.bind(_sb.agrupamentos),
  removeCliente: _sb.agrupamentos.removeCliente.bind(_sb.agrupamentos),
};

// @fallback join complexo levantamentos+clientes+planejamentos+regioes+pluvio_risco — sem endpoint NestJS
export const map = {
  fullDataByCliente: _sb.map.fullDataByCliente.bind(_sb.map),
  itemStatusesByCliente: _sb.map.itemStatusesByCliente.bind(_sb.map),
};

// Domínio: levantamento_item_evidencias (item_id FK)
// Endpoint: POST /levantamentos/itens/:itemId/evidencias
export const evidenciasItem = {
  /** POST /levantamentos/itens/:itemId/evidencias — adiciona evidência ao item */
  add: async (...args: Parameters<typeof _sb.evidenciasItem.add>): Promise<Ret<typeof _sb.evidenciasItem.add>> => {
    const [itemId, url, legenda] = args as [string, string, string?];
    try { return await http.post(`/levantamentos/itens/${itemId}/evidencias`, { url, legenda }); }
    catch { return _sb.evidenciasItem.add(...args); }
  },
};

// Domínio: levantamento_item_evidencias (item_id FK)
export const levantamentoItemEvidencias = {
  /** GET /levantamentos/itens/:id/evidencias — lista evidências do item */
  listByItem: async (itemId: string): Promise<Ret<typeof _sb.levantamentoItemEvidencias.listByItem>> => {
    try { return await http.get(`/levantamentos/itens/${itemId}/evidencias`); }
    catch { return _sb.levantamentoItemEvidencias.listByItem(itemId); }
  },
};
