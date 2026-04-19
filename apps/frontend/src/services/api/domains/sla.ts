import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToSnake, type Ret } from '../shared/case-mappers';

export const sla = {
  listByCliente: (clienteId: string): Promise<Ret<typeof _sb.sla.listByCliente>> =>
    http.get(`/sla${qs({ clienteId })}`),

  listForPanel: (clienteId: string, agenteId?: string): Promise<Ret<typeof _sb.sla.listForPanel>> =>
    http.get(`/sla/painel${qs({ clienteId, agenteId })}`),

  updateStatus: (
    slaId: string,
    updates: Parameters<typeof _sb.sla.updateStatus>[1],
  ): Promise<void> =>
    http.patch(`/sla/${slaId}/status`, updates),

  reabrir: (slaId: string): Promise<void> =>
    http.post(`/sla/${slaId}/reabrir`, {}),

  verificarVencidos: (clienteId: string): Promise<number> =>
    http.get(`/sla/pendentes/count${qs({ clienteId })}`),

  escalar: (slaId: string): Promise<Ret<typeof _sb.sla.escalar>> =>
    http.post(`/sla/${slaId}/escalar`, {}),

  pendingCount: (clienteId: string): Promise<number> =>
    http.get(`/sla/pendentes/count${qs({ clienteId })}`),

  concluir: (slaId: string): Promise<void> =>
    http.post(`/sla/${slaId}/concluir`, {}),

  atribuir: (slaId: string, agenteId: string): Promise<void> =>
    http.patch(`/sla/${slaId}/atribuir`, { agenteId }),

  errosCriacao: async (clienteId: string): Promise<Ret<typeof _sb.sla.errosCriacao>> => {
    const raw = await http.get(`/sla/erros${qs({ clienteId })}`);
    return deepToSnake(raw) as Ret<typeof _sb.sla.errosCriacao>;
  },
};

export const slaFeriados = {
  listByCliente: async (clienteId: string) => {
    const raw = await http.get(`/sla/feriados${qs({ clienteId })}`);
    return deepToSnake(raw) as Ret<typeof _sb.slaFeriados.listByCliente>;
  },
  create: async (payload: Parameters<typeof _sb.slaFeriados.create>[0]) => {
    const raw = await http.post('/sla/feriados', payload);
    return deepToSnake(raw) as Ret<typeof _sb.slaFeriados.create>;
  },
  remove: (id: string): Promise<void> =>
    http.delete(`/sla/feriados/${id}`),
  seedNacionais: (): Promise<unknown> => http.post('/sla/feriados/seed-nacionais', {}),
};

export const slaIminentes = {
  listByCliente: async (_clienteId: string): Promise<Ret<typeof _sb.slaIminentes.listByCliente>> => {
    const raw = await http.get('/sla/iminentes');
    return deepToSnake(raw) as Ret<typeof _sb.slaIminentes.listByCliente>;
  },
  countByCliente: async (_clienteId: string): Promise<Ret<typeof _sb.slaIminentes.countByCliente>> => {
    const raw = await http.get('/sla/iminentes') as unknown[];
    return (Array.isArray(raw) ? raw.length : 0) as Ret<typeof _sb.slaIminentes.countByCliente>;
  },
};

export const slaConfig = {
  getByCliente: async (clienteId: string) => {
    const raw = await http.get(`/sla/config${qs({ clienteId })}`);
    return raw ? (deepToSnake(raw) as Ret<typeof _sb.slaConfig.getByCliente>) : null;
  },
  upsert: (clienteId: string, config: Record<string, unknown>, existingId?: string | null): Promise<void> =>
    http.put('/sla/config', { clienteId, config, existingId }),
};

export const slaConfigRegiao = {
  listByCliente: async (clienteId: string) => {
    const raw = await http.get(`/sla/config/regioes${qs({ clienteId })}`);
    return deepToSnake(raw) as Ret<typeof _sb.slaConfigRegiao.listByCliente>;
  },
  upsert: async (clienteId: string, regiaoId: string, config: Record<string, unknown>) => {
    const raw = await http.put(`/sla/config/regioes/${regiaoId}`, { clienteId, config });
    return deepToSnake(raw) as Ret<typeof _sb.slaConfigRegiao.upsert>;
  },
  remove: (regiaoId: string): Promise<void> => http.delete(`/sla/config/regioes/${regiaoId}`),
};

export const slaErros = {
  listByCliente: async (clienteId: string) => {
    const raw = await http.get(`/sla/erros${qs({ clienteId })}`);
    return deepToSnake(raw) as Ret<typeof _sb.slaErros.listByCliente>;
  },
};

export const slaConfigAudit = {
  listByCliente: (): Promise<unknown> => http.get('/sla/config/audit'),
};

export const slaInteligente = {
  listByCliente: (): Promise<unknown> => http.get('/sla/inteligente'),
  listCriticos: (): Promise<unknown> => http.get('/sla/inteligente/criticos'),
  getByFocoId: (focoId: string): Promise<unknown> => http.get(`/sla/inteligente/foco/${focoId}`),
};
