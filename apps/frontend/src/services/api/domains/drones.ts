import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToCamel, deepToSnake, type Ret } from '../shared/case-mappers';

export const drones = {
  list: async (clienteId: string) => {
    const raw = await http.get(`/drones${qs({ clienteId })}`);
    return deepToSnake(raw) as Ret<typeof _sb.drones.list>;
  },
  create: async (payload: Parameters<typeof _sb.drones.create>[0]) => {
    const raw = await http.post('/drones', deepToCamel(payload));
    return deepToSnake(raw) as Ret<typeof _sb.drones.create>;
  },
  update: (id: string, payload: Parameters<typeof _sb.drones.update>[1]): Promise<void> =>
    http.put(`/drones/${id}`, deepToCamel(payload)),
  remove: (id: string): Promise<void> =>
    http.delete(`/drones/${id}`),
};

export const voos = {
  listByCliente: async (clienteId: string) => {
    const raw = await http.get(`/drones/voos${qs({ clienteId })}`);
    return deepToSnake(raw) as Ret<typeof _sb.voos.listByCliente>;
  },
  create: async (payload: Parameters<typeof _sb.voos.create>[0]) => {
    const raw = await http.post('/drones/voos', deepToCamel(payload));
    return deepToSnake(raw) as Ret<typeof _sb.voos.create>;
  },
  update: (id: string, payload: Parameters<typeof _sb.voos.update>[1]): Promise<void> =>
    http.put(`/drones/voos/${id}`, deepToCamel(payload)),
  remove: (id: string): Promise<void> =>
    http.delete(`/drones/voos/${id}`),
  bulkCreate: (rows: Record<string, unknown>[]): Promise<{ importados: number }> =>
    http.post('/drones/voos/bulk-create', { rows: rows.map(r => deepToCamel(r)) }),
};

export const pipeline = {
  listRuns: async (clienteId: string, limit?: number) => {
    const raw = await http.get(`/drones/pipelines${qs({ clienteId, limit })}`);
    return deepToSnake(raw) as Ret<typeof _sb.pipeline.listRuns>;
  },
  getRunAtivo: async (clienteId: string) => {
    const raw = await http.get(`/drones/pipelines${qs({ clienteId, status: 'em_andamento', limit: 1 })}`);
    const arr = deepToSnake(raw) as Ret<typeof _sb.pipeline.listRuns>;
    return (arr[0] ?? null) as Ret<typeof _sb.pipeline.getRunAtivo>;
  },
};

export const condicoesVoo = {
  avaliarByCliente: async (clienteId: string, data?: string) => {
    const raw = await http.get(`/drones/condicoes-voo${qs({ clienteId, data })}`);
    return deepToSnake(raw) as Ret<typeof _sb.condicoesVoo.avaliarByCliente>;
  },
};

export const yoloFeedback = {
  upsert: (payload: Parameters<typeof _sb.yoloFeedback.upsert>[0]): Promise<void> =>
    http.post('/drones/yolo-feedback', deepToCamel(payload)),
  getByItem: (levantamentoItemId: string, _clienteId: string) =>
    http.get(`/drones/yolo-feedback/by-item${qs({ levantamentoItemId })}`),
};

export const yoloClassConfig = {
  listByCliente: (_clienteId: string) =>
    http.get('/drones/yolo-class-config'),
};

export const yoloQualidade = {
  resumo: (_clienteId: string) =>
    http.get('/drones/yolo-qualidade/resumo'),
};

export const droneRiskConfig = {
  getByCliente: (_clienteId: string) =>
    http.get('/drones/risk-config'),
  update: (_clienteId: string, payload: Record<string, unknown>): Promise<{ ok: boolean }> =>
    http.put('/drones/risk-config', deepToCamel(payload)),
  listYoloClasses: (_clienteId: string) =>
    http.get('/drones/risk-config/yolo-classes'),
  updateYoloClass: (id: string, payload: Record<string, unknown>): Promise<{ ok: boolean }> =>
    http.put(`/drones/risk-config/yolo-classes/${id}`, deepToCamel(payload)),
  listSynonyms: (_clienteId: string) =>
    http.get('/drones/risk-config/synonyms'),
  addSynonym: (_clienteId: string, synonym: string, mapsTo: string) =>
    http.post('/drones/risk-config/synonyms', { synonym, mapsTo }),
  deleteSynonym: (id: string): Promise<{ ok: boolean }> =>
    http.delete(`/drones/risk-config/synonyms/${id}`),
};
