import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToCamel, deepToSnake, type Ret } from '../shared/case-mappers';

export const drones = {
  list: async (clienteId: string) => {
    try {
      const raw = await http.get(`/drones${qs({ clienteId })}`);
      return deepToSnake(raw) as Ret<typeof _sb.drones.list>;
    } catch { return _sb.drones.list(clienteId); }
  },
  create: async (payload: Parameters<typeof _sb.drones.create>[0]) => {
    try {
      const raw = await http.post('/drones', deepToCamel(payload));
      return deepToSnake(raw) as Ret<typeof _sb.drones.create>;
    } catch { return _sb.drones.create(payload); }
  },
  update: async (id: string, payload: Parameters<typeof _sb.drones.update>[1]) => {
    try { await http.put(`/drones/${id}`, deepToCamel(payload)); }
    catch { await _sb.drones.update(id, payload); }
  },
  remove: async (id: string) => {
    try { await http.delete(`/drones/${id}`); }
    catch { await _sb.drones.remove(id); }
  },
};

export const voos = {
  listByCliente: async (clienteId: string) => {
    try {
      const raw = await http.get(`/drones/voos${qs({ clienteId })}`);
      return deepToSnake(raw) as Ret<typeof _sb.voos.listByCliente>;
    } catch { return _sb.voos.listByCliente(clienteId); }
  },
  create: async (payload: Parameters<typeof _sb.voos.create>[0]) => {
    try {
      const raw = await http.post('/drones/voos', deepToCamel(payload));
      return deepToSnake(raw) as Ret<typeof _sb.voos.create>;
    } catch { return _sb.voos.create(payload); }
  },
  update: async (id: string, payload: Parameters<typeof _sb.voos.update>[1]) => {
    try { await http.put(`/drones/voos/${id}`, deepToCamel(payload)); }
    catch { await _sb.voos.update(id, payload); }
  },
  remove: async (id: string): Promise<void> => {
    try { await http.delete(`/drones/voos/${id}`); }
    catch { return _sb.voos.remove(id); }
  },
  /** @fallback bulk não suportado pelo backend — usa Supabase. */
  bulkCreate: _sb.voos.bulkCreate.bind(_sb.voos),
};

export const pipeline = {
  listRuns: async (clienteId: string, limit?: number) => {
    try {
      const raw = await http.get(`/drones/pipelines${qs({ clienteId, limit })}`);
      return deepToSnake(raw) as Ret<typeof _sb.pipeline.listRuns>;
    } catch { return _sb.pipeline.listRuns(clienteId, limit); }
  },
  getRunAtivo: async (clienteId: string) => {
    try {
      const raw = await http.get(`/drones/pipelines${qs({ clienteId, status: 'em_andamento', limit: 1 })}`);
      const arr = deepToSnake(raw) as Ret<typeof _sb.pipeline.listRuns>;
      return (arr[0] ?? null) as Ret<typeof _sb.pipeline.getRunAtivo>;
    } catch { return _sb.pipeline.getRunAtivo(clienteId); }
  },
};

export const condicoesVoo = {
  avaliarByCliente: async (clienteId: string, data?: string) => {
    try {
      const raw = await http.get(`/drones/condicoes-voo${qs({ clienteId, data })}`);
      return deepToSnake(raw) as Ret<typeof _sb.condicoesVoo.avaliarByCliente>;
    } catch { return _sb.condicoesVoo.avaliarByCliente(clienteId, data); }
  },
};

export const yoloFeedback = {
  upsert: async (payload: Parameters<typeof _sb.yoloFeedback.upsert>[0]) => {
    try { await http.post('/drones/yolo-feedback', deepToCamel(payload)); }
    catch { await _sb.yoloFeedback.upsert(payload); }
  },
  /** @fallback GET não implementado no backend — usa Supabase. */
  getByItem: _sb.yoloFeedback.getByItem.bind(_sb.yoloFeedback),
};

// @fallback tabela sentinela_yolo_class_config — sem endpoint NestJS
export const yoloClassConfig = {
  listByCliente: _sb.yoloClassConfig.listByCliente.bind(_sb.yoloClassConfig),
};

// @fallback tabela vistoria_drone_correlacao — sem endpoint NestJS
export const yoloQualidade = {
  resumo: _sb.yoloQualidade.resumo.bind(_sb.yoloQualidade),
};

// @fallback tabelas sentinela_drone_risk_config + yolo_* — sem endpoint NestJS
export const droneRiskConfig = {
  getByCliente: _sb.droneRiskConfig.getByCliente.bind(_sb.droneRiskConfig),
  update: _sb.droneRiskConfig.update.bind(_sb.droneRiskConfig),
  listYoloClasses: _sb.droneRiskConfig.listYoloClasses.bind(_sb.droneRiskConfig),
  updateYoloClass: _sb.droneRiskConfig.updateYoloClass.bind(_sb.droneRiskConfig),
  listSynonyms: _sb.droneRiskConfig.listSynonyms.bind(_sb.droneRiskConfig),
  addSynonym: _sb.droneRiskConfig.addSynonym.bind(_sb.droneRiskConfig),
  deleteSynonym: _sb.droneRiskConfig.deleteSynonym.bind(_sb.droneRiskConfig),
};
