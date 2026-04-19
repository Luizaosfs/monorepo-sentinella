import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToCamel, deepToSnake, type Ret } from '../shared/case-mappers';

export const billing = {
  listPlanos: async () => {
    const raw = await http.get('/billing/planos');
    return deepToSnake(raw) as Ret<typeof _sb.billing.listPlanos>;
  },
  getClientePlano: async (clienteId: string) => {
    const raw = await http.get(`/billing/cliente-plano${qs({ clienteId })}`);
    return raw ? (deepToSnake(raw) as Ret<typeof _sb.billing.getClientePlano>) : null;
  },
  updateClientePlano: (clienteId: string, payload: Parameters<typeof _sb.billing.updateClientePlano>[1]): Promise<void> =>
    http.post('/billing/cliente-plano', deepToCamel({ clienteId, ...payload })),
  listCiclos: async (clienteId: string) => {
    const raw = await http.get(`/billing/ciclos${qs({ clienteId })}`);
    return deepToSnake(raw) as Ret<typeof _sb.billing.listCiclos>;
  },
  listResumo: async () => { throw new Error('[sem endpoint NestJS] billing.listResumo'); },
  listSnapshots: async () => { throw new Error('[sem endpoint NestJS] billing.listSnapshots'); },
  getUltimoSnapshot: async () => { throw new Error('[sem endpoint NestJS] billing.getUltimoSnapshot'); },
  triggerSnapshot: async () => { throw new Error('[sem endpoint NestJS] billing.triggerSnapshot'); },
};

export const quotas = {
  byCliente: async (clienteId: string) => {
    const raw = await http.get(`/billing/quotas${qs({ clienteId })}`);
    return raw ? (deepToSnake(raw) as Ret<typeof _sb.quotas.byCliente>) : null;
  },
  usoMensal: async (clienteId: string) => {
    const raw = await http.get(`/billing/uso-mensal${qs({ clienteId })}`);
    return raw ? (deepToSnake(raw) as Ret<typeof _sb.quotas.usoMensal>) : null;
  },
  usoMensalAll: async () => {
    const raw = await http.get('/billing/uso-mensal/todos');
    return deepToSnake(raw) as Ret<typeof _sb.quotas.usoMensalAll>;
  },
  verificar: async (clienteId: string, metrica: Parameters<typeof _sb.quotas.verificar>[1]) => {
    const raw = await http.get(`/billing/verificar-quota${qs({ clienteId, metrica })}`);
    return deepToSnake(raw) as Ret<typeof _sb.quotas.verificar>;
  },
  update: async (clienteId: string, limites: Parameters<typeof _sb.quotas.update>[1]) => {
    const raw = await http.put('/billing/quotas', deepToCamel({ clienteId, ...limites }));
    return deepToSnake(raw) as Ret<typeof _sb.quotas.update>;
  },
};
