import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToCamel, deepToSnake, type Ret } from '../shared/case-mappers';

export const systemHealth = {
  listLogs: async (servico?: string, limit?: number) => {
    try {
      const raw = await http.get(`/dashboard/health${qs({ servico, limit })}`);
      return deepToSnake(raw) as Ret<typeof _sb.systemHealth.listLogs>;
    } catch { return _sb.systemHealth.listLogs(servico, limit); }
  },
  latestByServico: async () => {
    try {
      const raw = await http.get('/dashboard/health');
      return deepToSnake(raw) as Ret<typeof _sb.systemHealth.latestByServico>;
    } catch { return _sb.systemHealth.latestByServico(); }
  },
  listAlerts: async (apenasAtivos?: boolean) => {
    try {
      const raw = await http.get(`/dashboard/alerts${qs({ apenasAtivos })}`);
      return deepToSnake(raw) as Ret<typeof _sb.systemHealth.listAlerts>;
    } catch { return _sb.systemHealth.listAlerts(apenasAtivos); }
  },
  /** PUT /dashboard/alerts/:id/resolver — marca alerta como resolvido. */
  resolverAlerta: async (...args: Parameters<typeof _sb.systemHealth.resolverAlerta>): Promise<void> => {
    try { await http.put(`/dashboard/alerts/${args[0]}/resolver`, {}); }
    catch { return _sb.systemHealth.resolverAlerta(...args); }
  },
  /** @fallback Edge Function health-check — usa Supabase. */
  triggerHealthCheck: _sb.systemHealth.triggerHealthCheck.bind(_sb.systemHealth),
};

export const importLog = {
  /** HTTP POST /import-log — cria log de importação. */
  criar: async (payload: Parameters<typeof _sb.importLog.criar>[0]) => {
    try {
      const raw = await http.post('/import-log', deepToCamel(payload));
      return deepToSnake(raw) as Ret<typeof _sb.importLog.criar>;
    } catch { return _sb.importLog.criar(payload); }
  },
  /** @fallback backend não tem endpoint PATCH/finalizar (log imutável). */
  finalizar: _sb.importLog.finalizar.bind(_sb.importLog),
  /** HTTP GET /import-log?clienteId=X — lista logs do cliente. */
  listarByCliente: async (clienteId: string) => {
    try {
      const raw = await http.get(`/import-log${qs({ clienteId })}`);
      return deepToSnake(raw) as Ret<typeof _sb.importLog.listarByCliente>;
    } catch { return _sb.importLog.listarByCliente(clienteId); }
  },
};

// @fallback Edge Function cnes-sync + tabelas unidades_saude_sync_* — sem endpoint NestJS
export const cnesSync = {
  sincronizarManual: _sb.cnesSync.sincronizarManual.bind(_sb.cnesSync),
  listarControle: _sb.cnesSync.listarControle.bind(_sb.cnesSync),
  listarLog: _sb.cnesSync.listarLog.bind(_sb.cnesSync),
  emAndamento: _sb.cnesSync.emAndamento.bind(_sb.cnesSync),
};

// @fallback tabela offline_sync_log — fire-and-forget; sem endpoint NestJS
export const offlineSyncLog = {
  registrar: _sb.offlineSyncLog.registrar.bind(_sb.offlineSyncLog),
};

export const jobQueue = {
  /** GET /jobs?status= — lista jobs da fila. */
  list: async (...args: Parameters<typeof _sb.jobQueue.list>): Promise<Ret<typeof _sb.jobQueue.list>> => {
    try {
      const [status] = args as [string?];
      return deepToSnake(await http.get(`/jobs${qs({ status })}`)) as Ret<typeof _sb.jobQueue.list>;
    } catch { return _sb.jobQueue.list(...args); }
  },

  /** GET /jobs/:id — busca job por ID. */
  get: async (id: string): Promise<Ret<typeof _sb.jobQueue.get>> => {
    try { return deepToSnake(await http.get(`/jobs/${id}`)) as Ret<typeof _sb.jobQueue.get>; }
    catch { return _sb.jobQueue.get(id); }
  },

  /** POST /jobs — enfileira novo job. */
  enqueue: async (...args: Parameters<typeof _sb.jobQueue.enqueue>): Promise<Ret<typeof _sb.jobQueue.enqueue>> => {
    try { return await http.post('/jobs', deepToCamel(args[0] as Record<string, unknown>)); }
    catch { return _sb.jobQueue.enqueue(...args); }
  },

  /** @fallback sem endpoint /jobs/:id/retry no backend. */
  retry: _sb.jobQueue.retry.bind(_sb.jobQueue),
  /** @fallback sem endpoint /jobs/:id/cancel no backend. */
  cancel: _sb.jobQueue.cancel.bind(_sb.jobQueue),
};

// @fallback tabela audit_log — sem endpoint NestJS
export const auditLog = {
  list: _sb.auditLog.list.bind(_sb.auditLog),
};

// @fallback tabela alerta_retorno_imovel — sem endpoint NestJS
export const alertasRetorno = {
  listByAgente: _sb.alertasRetorno.listByAgente.bind(_sb.alertasRetorno),
  resolver: _sb.alertasRetorno.resolver.bind(_sb.alertasRetorno),
};

// @fallback view v_historico_atendimento_local — sem endpoint NestJS
export const historicoAtendimento = {
  listByClienteELocalizacao: _sb.historicoAtendimento.listByClienteELocalizacao.bind(_sb.historicoAtendimento),
  listByCliente: _sb.historicoAtendimento.listByCliente.bind(_sb.historicoAtendimento),
};
