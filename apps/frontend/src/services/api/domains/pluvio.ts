import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToCamel, deepToSnake, type Ret } from '../shared/case-mappers';

export const pluvio = {
  /** @fallback join regioes+pluvio_risco — usa Supabase. */
  riscoByCliente: _sb.pluvio.riscoByCliente.bind(_sb.pluvio),
  latestRunByCliente: async (clienteId: string) => {
    try {
      const raw = await http.get(`/pluvio/runs/latest${qs({ clienteId })}`);
      return raw ? (deepToSnake(raw) as Ret<typeof _sb.pluvio.latestRunByCliente>) : null;
    } catch { return _sb.pluvio.latestRunByCliente(clienteId); }
  },
};

export const pluvioOperacional = {
  listRuns: async (clienteId?: string) => {
    try {
      const raw = await http.get(`/pluvio/runs${qs({ clienteId })}`);
      return deepToSnake(raw) as Ret<typeof _sb.pluvioOperacional.listRuns>;
    } catch { return _sb.pluvioOperacional.listRuns(clienteId); }
  },
  createRun: async (payload: Parameters<typeof _sb.pluvioOperacional.createRun>[0]) => {
    try { await http.post('/pluvio/runs', deepToCamel(payload)); }
    catch { await _sb.pluvioOperacional.createRun(payload); }
  },
  createRunGetId: async (payload: Parameters<typeof _sb.pluvioOperacional.createRunGetId>[0]) => {
    try {
      const raw = await http.post('/pluvio/runs', deepToCamel(payload));
      return (deepToSnake(raw) as { id: string }).id;
    } catch { return _sb.pluvioOperacional.createRunGetId(payload); }
  },
  deleteRun: async (id: string) => {
    try { await http.delete(`/pluvio/runs/${id}`); }
    catch { await _sb.pluvioOperacional.deleteRun(id); }
  },
  updateRunTotal: async (runId: string) => {
    try { await http.patch(`/pluvio/runs/${runId}/total`, {}); }
    catch { await _sb.pluvioOperacional.updateRunTotal(runId); }
  },
  listItems: async (runId: string) => {
    try {
      const raw = await http.get(`/pluvio/runs/${runId}/items`);
      return deepToSnake(raw) as Ret<typeof _sb.pluvioOperacional.listItems>;
    } catch { return _sb.pluvioOperacional.listItems(runId); }
  },
  upsertItem: async (id: string | null, payload: Parameters<typeof _sb.pluvioOperacional.upsertItem>[1]) => {
    try { await http.put('/pluvio/items', deepToCamel({ id, ...payload })); }
    catch { await _sb.pluvioOperacional.upsertItem(id, payload); }
  },
  deleteItem: async (id: string) => {
    try { await http.delete(`/pluvio/items/${id}`); }
    catch { await _sb.pluvioOperacional.deleteItem(id); }
  },
  bulkInsertItems: async (rows: Parameters<typeof _sb.pluvioOperacional.bulkInsertItems>[0]) => {
    try { await http.post('/pluvio/items/bulk', rows.map((r) => deepToCamel(r))); }
    catch { await _sb.pluvioOperacional.bulkInsertItems(rows); }
  },
};

export const pluvioRisco = {
  listByRegioes: async (regIds: string[]) => {
    if (regIds.length === 0) return [];
    try {
      const raw = await http.get(`/pluvio/risco${qs({ regiaoId: regIds })}`);
      return deepToSnake(raw) as Ret<typeof _sb.pluvioRisco.listByRegioes>;
    } catch { return _sb.pluvioRisco.listByRegioes(regIds); }
  },
  upsert: async (id: string | null, payload: Parameters<typeof _sb.pluvioRisco.upsert>[1]) => {
    try { await http.put('/pluvio/risco', deepToCamel({ id, ...payload })); }
    catch { await _sb.pluvioRisco.upsert(id, payload); }
  },
  remove: async (id: string) => {
    try { await http.delete(`/pluvio/risco/${id}`); }
    catch { await _sb.pluvioRisco.remove(id); }
  },
  bulkInsert: async (rows: Parameters<typeof _sb.pluvioRisco.bulkInsert>[0]) => {
    try { await http.post('/pluvio/risco/bulk', rows.map((r) => deepToCamel(r))); }
    catch { await _sb.pluvioRisco.bulkInsert(rows); }
  },
};
