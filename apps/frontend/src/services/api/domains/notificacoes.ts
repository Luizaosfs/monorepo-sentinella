import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToCamel, deepToSnake, type Ret } from '../shared/case-mappers';

export const casosNotificados = {
  list: async (clienteId: string) => {
    const raw = await http.get(`/notificacoes/casos${qs({ clienteId })}`);
    return deepToSnake(raw) as Ret<typeof _sb.casosNotificados.list>;
  },
  create: async (payload: Parameters<typeof _sb.casosNotificados.create>[0]) => {
    const raw = await http.post('/notificacoes/casos', deepToCamel(payload));
    return deepToSnake(raw) as Ret<typeof _sb.casosNotificados.create>;
  },
  updateStatus: (id: string, status: Parameters<typeof _sb.casosNotificados.updateStatus>[1]): Promise<void> =>
    http.put(`/notificacoes/casos/${id}`, { status }),
  update: (id: string, payload: Parameters<typeof _sb.casosNotificados.update>[1]): Promise<void> =>
    http.put(`/notificacoes/casos/${id}`, deepToCamel(payload)),
  listProximosAoPonto: async (lat: number, lng: number, clienteId: string, raioMetros?: number) => {
    const raw = await http.get(`/notificacoes/casos/no-raio${qs({ lat, lng, clienteId, raioMetros })}`);
    return deepToSnake(raw) as Ret<typeof _sb.casosNotificados.listProximosAoPonto>;
  },
  listPaginado: async () => { throw new Error('[sem endpoint NestJS] casosNotificados.listPaginado'); },
  countProximoAoItem: async () => { throw new Error('[sem endpoint NestJS] casosNotificados.countProximoAoItem'); },
  cruzamentosDoItem: async () => { throw new Error('[sem endpoint NestJS] casosNotificados.cruzamentosDoItem'); },
  cruzamentosDoCaso: async () => { throw new Error('[sem endpoint NestJS] casosNotificados.cruzamentosDoCaso'); },
  countCruzadosHoje: async () => { throw new Error('[sem endpoint NestJS] casosNotificados.countCruzadosHoje'); },
  listCasoIdsComCruzamento: async () => { throw new Error('[sem endpoint NestJS] casosNotificados.listCasoIdsComCruzamento'); },
  listCruzamentos: async () => { throw new Error('[sem endpoint NestJS] casosNotificados.listCruzamentos'); },
};

export const unidadesSaude = {
  list: async (clienteId: string) => {
    const raw = await http.get(`/notificacoes/unidades-saude${qs({ clienteId })}`);
    return deepToSnake(raw) as Ret<typeof _sb.unidadesSaude.list>;
  },
  create: async (payload: Parameters<typeof _sb.unidadesSaude.create>[0]) => {
    const raw = await http.post('/notificacoes/unidades-saude', deepToCamel(payload));
    return deepToSnake(raw) as Ret<typeof _sb.unidadesSaude.create>;
  },
  update: (id: string, payload: Parameters<typeof _sb.unidadesSaude.update>[1]): Promise<void> =>
    http.put(`/notificacoes/unidades-saude/${id}`, deepToCamel(payload)),
};

export const notificacoesESUS = {
  listByCliente: async (clienteId: string) => {
    const raw = await http.get(`/notificacoes/esus${qs({ clienteId })}`);
    return deepToSnake(raw) as Ret<typeof _sb.notificacoesESUS.listByCliente>;
  },
  listByItem: async (itemId: string, clienteId: string) => {
    const raw = await http.get(`/notificacoes/esus${qs({ clienteId, itemId })}`);
    return deepToSnake(raw) as Ret<typeof _sb.notificacoesESUS.listByItem>;
  },
  enviar: (
    _clienteId: string,
    itemId: string,
    tipoAgravo: string,
    _enviadoPor: string,
    _integracao: unknown,
    itemData: {
      endereco_completo?: string | null;
      endereco_curto?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      data_hora?: string | null;
    },
  ): Promise<Record<string, unknown>> =>
    http.post('/notificacoes/esus/enviar', {
      levantamentoItemId: itemId,
      tipoAgravo,
      enderecoCompleto: itemData.endereco_completo,
      enderecoCurto:    itemData.endereco_curto,
      latitude:         itemData.latitude,
      longitude:        itemData.longitude,
      dataHora:         itemData.data_hora,
    }),

  reenviar: (notifId: string, _integracao: unknown): Promise<Record<string, unknown>> =>
    http.post(`/notificacoes/esus/${notifId}/reenviar`, {}),
};

export const pushSubscriptions = {
  upsert: (payload: Parameters<typeof _sb.pushSubscriptions.upsert>[0]): Promise<void> =>
    http.post('/notificacoes/push', deepToCamel(payload)),
  /**
   * @deprecated No-op — nenhuma tela consome a lista de push subscriptions por cliente.
   */
  listByCliente: async (..._args: unknown[]): Promise<Record<string, unknown>[]> => {
    return [];
  },

  /**
   * @deprecated No-op com aviso — assinatura não é removida do banco no logout.
   * O browser unsubscribe continua funcionando; registro órfão no banco é limpeza de infra futura.
   */
  removeByEndpoint: async (_endpoint: string): Promise<void> => {
    console.warn('[deprecated] pushSubscriptions.removeByEndpoint foi chamado mas é no-op — assinatura não será removida do banco');
    return;
  },
};

export const notificacaoFormal = {
  gerarProtocolo: async (clienteId: string) => {
    const raw = await http.post('/notificacoes/protocolo/proximo', { clienteId });
    if (typeof raw === 'string') return raw;
    return ((raw as Record<string, unknown>).protocolo ?? (raw as Record<string, unknown>).numero ?? String(raw)) as string;
  },
};

export const canalCidadao = {
  stats: async () => { throw new Error('[sem endpoint NestJS] canalCidadao.stats'); },
  /**
   * @deprecated No-op — nenhuma tela consome canalCidadao.eventosAudit no frontend atual.
   */
  eventosAudit: async (..._args: unknown[]): Promise<Record<string, unknown>[]> => {
    return [];
  },
};
