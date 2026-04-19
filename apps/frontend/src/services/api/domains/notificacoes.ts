import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToCamel, deepToSnake, type Ret } from '../shared/case-mappers';

export const casosNotificados = {
  list: async (clienteId: string) => {
    try {
      const raw = await http.get(`/notificacoes/casos${qs({ clienteId })}`);
      return deepToSnake(raw) as Ret<typeof _sb.casosNotificados.list>;
    } catch { return _sb.casosNotificados.list(clienteId); }
  },
  create: async (payload: Parameters<typeof _sb.casosNotificados.create>[0]) => {
    try {
      const raw = await http.post('/notificacoes/casos', deepToCamel(payload));
      return deepToSnake(raw) as Ret<typeof _sb.casosNotificados.create>;
    } catch { return _sb.casosNotificados.create(payload); }
  },
  updateStatus: async (id: string, status: Parameters<typeof _sb.casosNotificados.updateStatus>[1]) => {
    try { await http.put(`/notificacoes/casos/${id}`, { status }); }
    catch { await _sb.casosNotificados.updateStatus(id, status); }
  },
  update: async (id: string, payload: Parameters<typeof _sb.casosNotificados.update>[1]) => {
    try { await http.put(`/notificacoes/casos/${id}`, deepToCamel(payload)); }
    catch { await _sb.casosNotificados.update(id, payload); }
  },
  listProximosAoPonto: async (lat: number, lng: number, clienteId: string, raioMetros?: number) => {
    try {
      const raw = await http.get(`/notificacoes/casos/no-raio${qs({ lat, lng, clienteId, raioMetros })}`);
      return deepToSnake(raw) as Ret<typeof _sb.casosNotificados.listProximosAoPonto>;
    } catch { return _sb.casosNotificados.listProximosAoPonto(lat, lng, clienteId, raioMetros); }
  },
  /** @fallback cursor pagination — schema diferente do backend; usa Supabase. */
  listPaginado: _sb.casosNotificados.listPaginado.bind(_sb.casosNotificados),
  /** @fallback RPC contar_casos_proximos_ao_item — sem endpoint NestJS. */
  countProximoAoItem: _sb.casosNotificados.countProximoAoItem.bind(_sb.casosNotificados),
  /** @fallback tabela caso_foco_cruzamento — sem endpoint NestJS. */
  cruzamentosDoItem: _sb.casosNotificados.cruzamentosDoItem.bind(_sb.casosNotificados),
  cruzamentosDoCaso: _sb.casosNotificados.cruzamentosDoCaso.bind(_sb.casosNotificados),
  countCruzadosHoje: _sb.casosNotificados.countCruzadosHoje.bind(_sb.casosNotificados),
  listCasoIdsComCruzamento: _sb.casosNotificados.listCasoIdsComCruzamento.bind(_sb.casosNotificados),
  listCruzamentos: _sb.casosNotificados.listCruzamentos.bind(_sb.casosNotificados),
};

export const unidadesSaude = {
  list: async (clienteId: string) => {
    try {
      const raw = await http.get(`/notificacoes/unidades-saude${qs({ clienteId })}`);
      return deepToSnake(raw) as Ret<typeof _sb.unidadesSaude.list>;
    } catch { return _sb.unidadesSaude.list(clienteId); }
  },
  create: async (payload: Parameters<typeof _sb.unidadesSaude.create>[0]) => {
    try {
      const raw = await http.post('/notificacoes/unidades-saude', deepToCamel(payload));
      return deepToSnake(raw) as Ret<typeof _sb.unidadesSaude.create>;
    } catch { return _sb.unidadesSaude.create(payload); }
  },
  update: async (id: string, payload: Parameters<typeof _sb.unidadesSaude.update>[1]) => {
    try { await http.put(`/notificacoes/unidades-saude/${id}`, deepToCamel(payload)); }
    catch { await _sb.unidadesSaude.update(id, payload); }
  },
};

export const notificacoesESUS = {
  listByCliente: async (clienteId: string) => {
    try {
      const raw = await http.get(`/notificacoes/esus${qs({ clienteId })}`);
      return deepToSnake(raw) as Ret<typeof _sb.notificacoesESUS.listByCliente>;
    } catch { return _sb.notificacoesESUS.listByCliente(clienteId); }
  },
  listByItem: async (itemId: string, clienteId: string) => {
    try {
      const raw = await http.get(`/notificacoes/esus${qs({ clienteId, itemId })}`);
      return deepToSnake(raw) as Ret<typeof _sb.notificacoesESUS.listByItem>;
    } catch { return _sb.notificacoesESUS.listByItem(itemId, clienteId); }
  },
  /** @fallback payload e-SUS complexo (sinan.ts) — usa Supabase. */
  enviar: _sb.notificacoesESUS.enviar.bind(_sb.notificacoesESUS),
  /** @fallback sem endpoint NestJS. */
  reenviar: _sb.notificacoesESUS.reenviar.bind(_sb.notificacoesESUS),
};

export const pushSubscriptions = {
  upsert: async (payload: Parameters<typeof _sb.pushSubscriptions.upsert>[0]) => {
    try { await http.post('/notificacoes/push', deepToCamel(payload)); }
    catch { await _sb.pushSubscriptions.upsert(payload); }
  },
  /** @fallback uso interno da Edge Function — sem endpoint NestJS necessário. */
  listByCliente: _sb.pushSubscriptions.listByCliente.bind(_sb.pushSubscriptions),
  /** @fallback DELETE usa endpoint/:id no backend mas frontend passa endpoint string; usa Supabase. */
  removeByEndpoint: _sb.pushSubscriptions.removeByEndpoint.bind(_sb.pushSubscriptions),
};

export const notificacaoFormal = {
  gerarProtocolo: async (clienteId: string) => {
    try {
      const raw = await http.post('/notificacoes/protocolo/proximo', { clienteId });
      if (typeof raw === 'string') return raw;
      return ((raw as Record<string, unknown>).protocolo ?? (raw as Record<string, unknown>).numero ?? String(raw)) as string;
    } catch { return _sb.notificacaoFormal.gerarProtocolo(clienteId); }
  },
};

// @fallback views v_canal_cidadao_stats + _eventos_audit — sem endpoint NestJS
export const canalCidadao = {
  stats: _sb.canalCidadao.stats.bind(_sb.canalCidadao),
  eventosAudit: _sb.canalCidadao.eventosAudit.bind(_sb.canalCidadao),
};
