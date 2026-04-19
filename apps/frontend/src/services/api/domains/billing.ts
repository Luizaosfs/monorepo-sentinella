import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToCamel, deepToSnake, type Ret } from '../shared/case-mappers';

export const billing = {
  listPlanos: async () => {
    try {
      const raw = await http.get('/billing/planos');
      return deepToSnake(raw) as Ret<typeof _sb.billing.listPlanos>;
    } catch { return _sb.billing.listPlanos(); }
  },
  getClientePlano: async (clienteId: string) => {
    try {
      const raw = await http.get(`/billing/cliente-plano${qs({ clienteId })}`);
      return raw ? (deepToSnake(raw) as Ret<typeof _sb.billing.getClientePlano>) : null;
    } catch { return _sb.billing.getClientePlano(clienteId); }
  },
  updateClientePlano: async (clienteId: string, payload: Parameters<typeof _sb.billing.updateClientePlano>[1]) => {
    try { await http.post('/billing/cliente-plano', deepToCamel({ clienteId, ...payload })); }
    catch { await _sb.billing.updateClientePlano(clienteId, payload); }
  },
  listCiclos: async (clienteId: string) => {
    try {
      const raw = await http.get(`/billing/ciclos${qs({ clienteId })}`);
      return deepToSnake(raw) as Ret<typeof _sb.billing.listCiclos>;
    } catch { return _sb.billing.listCiclos(clienteId); }
  },
  /** @fallback view v_billing_resumo — sem endpoint NestJS. */
  listResumo: _sb.billing.listResumo.bind(_sb.billing),
  /** @fallback tabela billing_usage_snapshot — sem endpoint NestJS. */
  listSnapshots: _sb.billing.listSnapshots.bind(_sb.billing),
  getUltimoSnapshot: _sb.billing.getUltimoSnapshot.bind(_sb.billing),
  /** @fallback Edge Function billing-snapshot — usa Supabase. */
  triggerSnapshot: _sb.billing.triggerSnapshot.bind(_sb.billing),
};

export const quotas = {
  byCliente: async (clienteId: string) => {
    try {
      const raw = await http.get(`/billing/quotas${qs({ clienteId })}`);
      return raw ? (deepToSnake(raw) as Ret<typeof _sb.quotas.byCliente>) : null;
    } catch { return _sb.quotas.byCliente(clienteId); }
  },
  usoMensal: async (clienteId: string) => {
    try {
      const raw = await http.get(`/billing/uso-mensal${qs({ clienteId })}`);
      return raw ? (deepToSnake(raw) as Ret<typeof _sb.quotas.usoMensal>) : null;
    } catch { return _sb.quotas.usoMensal(clienteId); }
  },
  usoMensalAll: async () => {
    try {
      const raw = await http.get('/billing/uso-mensal/todos');
      return deepToSnake(raw) as Ret<typeof _sb.quotas.usoMensalAll>;
    } catch { return _sb.quotas.usoMensalAll(); }
  },
  verificar: async (clienteId: string, metrica: Parameters<typeof _sb.quotas.verificar>[1]) => {
    try {
      const raw = await http.get(`/billing/verificar-quota${qs({ clienteId, metrica })}`);
      return deepToSnake(raw) as Ret<typeof _sb.quotas.verificar>;
    } catch { return _sb.quotas.verificar(clienteId, metrica); }
  },
  update: async (clienteId: string, limites: Parameters<typeof _sb.quotas.update>[1]) => {
    try {
      const raw = await http.put('/billing/quotas', deepToCamel({ clienteId, ...limites }));
      return deepToSnake(raw) as Ret<typeof _sb.quotas.update>;
    } catch { return _sb.quotas.update(clienteId, limites); }
  },
};
