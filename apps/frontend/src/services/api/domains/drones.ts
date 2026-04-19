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
  bulkCreate: async () => { throw new Error('[sem endpoint NestJS] voos.bulkCreate'); },
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
  getByItem: async () => { throw new Error('[sem endpoint NestJS] yoloFeedback.getByItem'); },
};

export const yoloClassConfig = {
  listByCliente: async () => { throw new Error('[sem endpoint NestJS] yoloClassConfig.listByCliente'); },
};

export const yoloQualidade = {
  resumo: async () => { throw new Error('[sem endpoint NestJS] yoloQualidade.resumo'); },
};

export const droneRiskConfig = {
  getByCliente: async () => { throw new Error('[sem endpoint NestJS] droneRiskConfig.getByCliente'); },
  update: async () => { throw new Error('[sem endpoint NestJS] droneRiskConfig.update'); },
  listYoloClasses: async () => { throw new Error('[sem endpoint NestJS] droneRiskConfig.listYoloClasses'); },
  updateYoloClass: async () => { throw new Error('[sem endpoint NestJS] droneRiskConfig.updateYoloClass'); },
  listSynonyms: async () => { throw new Error('[sem endpoint NestJS] droneRiskConfig.listSynonyms'); },
  addSynonym: async () => { throw new Error('[sem endpoint NestJS] droneRiskConfig.addSynonym'); },
  deleteSynonym: async () => { throw new Error('[sem endpoint NestJS] droneRiskConfig.deleteSynonym'); },
};
