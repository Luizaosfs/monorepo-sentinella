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
  triggerHealthCheck: async () => { throw new Error('[sem endpoint NestJS] systemHealth.triggerHealthCheck'); },
};

export const importLog = {
  criar: async (payload: Parameters<typeof _sb.importLog.criar>[0]) => {
    const raw = await http.post('/import-log', deepToCamel(payload));
    return deepToSnake(raw) as Ret<typeof _sb.importLog.criar>;
  },
  finalizar: async () => { throw new Error('[sem endpoint NestJS] importLog.finalizar'); },
  listarByCliente: async (clienteId: string) => {
    const raw = await http.get(`/import-log${qs({ clienteId })}`);
    return deepToSnake(raw) as Ret<typeof _sb.importLog.listarByCliente>;
  },
};

export const cnesSync = {
  sincronizarManual: async () => { throw new Error('[sem endpoint NestJS] cnesSync.sincronizarManual'); },
  listarControle: async () => { throw new Error('[sem endpoint NestJS] cnesSync.listarControle'); },
  listarLog: async () => { throw new Error('[sem endpoint NestJS] cnesSync.listarLog'); },
  emAndamento: async () => { throw new Error('[sem endpoint NestJS] cnesSync.emAndamento'); },
};

export const offlineSyncLog = {
  registrar: async () => { throw new Error('[sem endpoint NestJS] offlineSyncLog.registrar'); },
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
  list: async () => { throw new Error('[sem endpoint NestJS] auditLog.list'); },
};

export const alertasRetorno = {
  listByAgente: async () => { throw new Error('[sem endpoint NestJS] alertasRetorno.listByAgente'); },
  resolver: async () => { throw new Error('[sem endpoint NestJS] alertasRetorno.resolver'); },
};

export const historicoAtendimento = {
  listByClienteELocalizacao: async () => { throw new Error('[sem endpoint NestJS] historicoAtendimento.listByClienteELocalizacao'); },
  listByCliente: async () => { throw new Error('[sem endpoint NestJS] historicoAtendimento.listByCliente'); },
};
