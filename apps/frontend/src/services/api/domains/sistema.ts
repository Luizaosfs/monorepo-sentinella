import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToCamel, deepToSnake, type Ret } from '../shared/case-mappers';

export const systemHealth = {
  listLogs: async (servico?: string, limit?: number) => {
    const raw = await http.get(`/dashboard/health${qs({ servico, limit })}`);
    return deepToSnake(raw) as Ret<typeof _sb.systemHealth.listLogs>;
  },
  latestByServico: async () => {
    const raw = await http.get('/dashboard/health');
    return deepToSnake(raw) as Ret<typeof _sb.systemHealth.latestByServico>;
  },
  listAlerts: async (apenasAtivos?: boolean) => {
    const raw = await http.get(`/dashboard/alerts${qs({ apenasAtivos })}`);
    return deepToSnake(raw) as Ret<typeof _sb.systemHealth.listAlerts>;
  },
  resolverAlerta: (...args: Parameters<typeof _sb.systemHealth.resolverAlerta>): Promise<void> =>
    http.put(`/dashboard/alerts/${args[0]}/resolver`, {}),
  triggerHealthCheck: async (): Promise<Ret<typeof _sb.systemHealth.triggerHealthCheck>> =>
    http.post('/dashboard/health/trigger', {}),
};

export const importLog = {
  criar: async (payload: Parameters<typeof _sb.importLog.criar>[0]) => {
    const raw = await http.post('/import-log', deepToCamel(payload));
    return deepToSnake(raw) as Ret<typeof _sb.importLog.criar>;
  },
  finalizar: async (...args: Parameters<typeof _sb.importLog.finalizar>) => {
    const [id, resultado] = args as [string, Record<string, unknown>];
    const raw = await http.patch(`/import-log/${id}/finalizar`, deepToCamel(resultado));
    return deepToSnake(raw) as Ret<typeof _sb.importLog.finalizar>;
  },
  listarByCliente: async (clienteId: string) => {
    const raw = await http.get(`/import-log${qs({ clienteId })}`);
    return deepToSnake(raw) as Ret<typeof _sb.importLog.listarByCliente>;
  },
};

export const cnesSync = {
  sincronizarManual: async (_clienteId?: string): Promise<Ret<typeof _sb.cnesSync.sincronizarManual>> =>
    http.post('/cnes/sincronizar', {}),
  listarControle: async (_clienteId?: string) => {
    const raw = await http.get('/cnes/controle');
    return deepToSnake(raw) as Ret<typeof _sb.cnesSync.listarControle>;
  },
  listarLog: async (_clienteId?: string) => {
    const raw = await http.get('/cnes/log');
    return deepToSnake(raw) as Ret<typeof _sb.cnesSync.listarLog>;
  },
  emAndamento: async (_clienteId?: string) => {
    const raw = await http.get('/cnes/em-andamento');
    return deepToSnake(raw) as Ret<typeof _sb.cnesSync.emAndamento>;
  },
};

export const offlineSyncLog = {
  /**
   * @deprecated No-op — nenhuma tela chama offlineSyncLog.registrar.
   * Telemetria de sync offline sem consumidor ativo no frontend.
   */
  registrar: async (..._args: unknown[]): Promise<void> => {
    return;
  },
};

export const jobQueue = {
  list: async (...args: Parameters<typeof _sb.jobQueue.list>): Promise<Ret<typeof _sb.jobQueue.list>> => {
    const [status] = args as [string?];
    return deepToSnake(await http.get(`/jobs${qs({ status })}`)) as Ret<typeof _sb.jobQueue.list>;
  },

  get: async (id: string): Promise<Ret<typeof _sb.jobQueue.get>> =>
    deepToSnake(await http.get(`/jobs/${id}`)) as Ret<typeof _sb.jobQueue.get>,

  enqueue: (...args: Parameters<typeof _sb.jobQueue.enqueue>): Promise<Ret<typeof _sb.jobQueue.enqueue>> =>
    http.post('/jobs', deepToCamel(args[0] as Record<string, unknown>)),

  retry: (id: string): Promise<Ret<typeof _sb.jobQueue.retry>> =>
    http.patch(`/jobs/${id}/retry`, {}),

  cancel: (id: string): Promise<Ret<typeof _sb.jobQueue.cancel>> =>
    http.delete(`/jobs/${id}`),
};

export const auditLog = {
  /**
   * @deprecated No-op — nenhuma tela consome auditLog.list no frontend atual.
   */
  list: async (..._args: unknown[]): Promise<Record<string, unknown>[]> => {
    return [];
  },
};

export const alertasRetorno = {
  listByAgente: async () => { throw new Error('[sem endpoint NestJS] alertasRetorno.listByAgente'); },
  resolver: async () => { throw new Error('[sem endpoint NestJS] alertasRetorno.resolver'); },
};

export const historicoAtendimento = {
  listByClienteELocalizacao: (_clienteId: string, lat: number, lng: number, tolerance: number): Promise<Record<string, unknown>[]> =>
    http.get(`/levantamentos/historico-atendimento/por-localizacao${qs({ lat, lng, tolerance })}`),

  listByCliente: (_clienteId: string): Promise<Record<string, unknown>[]> =>
    http.get('/levantamentos/historico-atendimento'),
};
