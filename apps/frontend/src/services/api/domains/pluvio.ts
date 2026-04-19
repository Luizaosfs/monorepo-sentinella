import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToCamel, deepToSnake, type Ret } from '../shared/case-mappers';

export const pluvio = {
  riscoByCliente: async (clienteId?: string) =>
    http.get(`/pluvio/risco/by-cliente${qs({ clienteId })}`),
  latestRunByCliente: async (clienteId: string) => {
    const raw = await http.get(`/pluvio/runs/latest${qs({ clienteId })}`);
    return raw ? (deepToSnake(raw) as Ret<typeof _sb.pluvio.latestRunByCliente>) : null;
  },
};

export const pluvioOperacional = {
  listRuns: async (clienteId?: string) => {
    const raw = await http.get(`/pluvio/runs${qs({ clienteId })}`);
    return deepToSnake(raw) as Ret<typeof _sb.pluvioOperacional.listRuns>;
  },
  createRun: (payload: Parameters<typeof _sb.pluvioOperacional.createRun>[0]): Promise<void> =>
    http.post('/pluvio/runs', deepToCamel(payload)),
  createRunGetId: async (payload: Parameters<typeof _sb.pluvioOperacional.createRunGetId>[0]) => {
    const raw = await http.post('/pluvio/runs', deepToCamel(payload));
    return (deepToSnake(raw) as { id: string }).id;
  },
  deleteRun: (id: string): Promise<void> =>
    http.delete(`/pluvio/runs/${id}`),
  updateRunTotal: (runId: string): Promise<void> =>
    http.patch(`/pluvio/runs/${runId}/total`, {}),
  listItems: async (runId: string) => {
    const raw = await http.get(`/pluvio/runs/${runId}/items`);
    return deepToSnake(raw) as Ret<typeof _sb.pluvioOperacional.listItems>;
  },
  upsertItem: (id: string | null, payload: Parameters<typeof _sb.pluvioOperacional.upsertItem>[1]): Promise<void> =>
    http.put('/pluvio/items', deepToCamel({ id, ...payload })),
  deleteItem: (id: string): Promise<void> =>
    http.delete(`/pluvio/items/${id}`),
  bulkInsertItems: (rows: Parameters<typeof _sb.pluvioOperacional.bulkInsertItems>[0]): Promise<void> =>
    http.post('/pluvio/items/bulk', rows.map((r) => deepToCamel(r))),
};

export const pluvioRisco = {
  listByRegioes: async (regIds: string[]) => {
    if (regIds.length === 0) return [];
    const raw = await http.get(`/pluvio/risco${qs({ regiaoId: regIds })}`);
    return deepToSnake(raw) as Ret<typeof _sb.pluvioRisco.listByRegioes>;
  },
  upsert: (id: string | null, payload: Parameters<typeof _sb.pluvioRisco.upsert>[1]): Promise<void> =>
    http.put('/pluvio/risco', deepToCamel({ id, ...payload })),
  remove: (id: string): Promise<void> =>
    http.delete(`/pluvio/risco/${id}`),
  bulkInsert: (rows: Parameters<typeof _sb.pluvioRisco.bulkInsert>[0]): Promise<void> =>
    http.post('/pluvio/risco/bulk', rows.map((r) => deepToCamel(r))),
};
