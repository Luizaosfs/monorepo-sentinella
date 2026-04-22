import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToSnake, type Ret } from '../shared/case-mappers';

export const usuarios = {
  listPapeis: (clienteId: string): Promise<Ret<typeof _sb.usuarios.listPapeis>> =>
    http.get(`/usuarios/papeis${qs({ clienteId })}`),

  listByCliente: async (clienteId: string): Promise<Ret<typeof _sb.usuarios.listByCliente>> => {
    const raw = await http.get(`/usuarios${qs({ clienteId })}`);
    return deepToSnake(raw) as Ret<typeof _sb.usuarios.listByCliente>;
  },

  listAll: async (): Promise<Ret<typeof _sb.usuarios.listAll>> => {
    const raw = await http.get('/usuarios');
    return deepToSnake(raw) as Ret<typeof _sb.usuarios.listAll>;
  },

  listAgentes: async (clienteId: string): Promise<Ret<typeof _sb.usuarios.listAgentes>> => {
    const raw = await http.get(`/usuarios${qs({ clienteId, papel: 'agente' })}`);
    return deepToSnake(raw) as Ret<typeof _sb.usuarios.listAgentes>;
  },

  listAllPapeis: (): Promise<Ret<typeof _sb.usuarios.listAllPapeis>> =>
    http.get('/usuarios/papeis'),

  checkEmailExists: async (email: string): Promise<boolean> => {
    const raw = await http.get(`/usuarios${qs({ email })}`) as unknown[];
    return Array.isArray(raw) ? raw.length > 0 : false;
  },

  insert: async (payload: Parameters<typeof _sb.usuarios.insert>[0]): Promise<Ret<typeof _sb.usuarios.insert>> => {
    const p = payload as unknown as {
      nome: string;
      email: string;
      senha: string;
      cliente_id?: string;
      clienteId?: string;
      papel?: string;
      papeis?: string[];
    };
    const body = {
      nome: p.nome,
      email: p.email,
      senha: p.senha,
      clienteId: p.clienteId ?? p.cliente_id,
      papeis: p.papeis ?? (p.papel ? [p.papel] : undefined),
    };
    return deepToSnake(await http.post('/usuarios', body)) as Ret<typeof _sb.usuarios.insert>;
  },

  update: async (id: string, payload: Parameters<typeof _sb.usuarios.update>[1]): Promise<Ret<typeof _sb.usuarios.update>> =>
    deepToSnake(await http.patch(`/usuarios/${id}`, payload)) as Ret<typeof _sb.usuarios.update>,

  updatePapel: (id: string, papel: string): Promise<void> =>
    http.patch(`/usuarios/${id}`, { papeis: [papel] }),

  setPapel: (id: string, papel: string): Promise<void> =>
    http.patch(`/usuarios/${id}`, { papeis: [papel] }),

  deletePapeis: (id: string): Promise<void> =>
    http.patch(`/usuarios/${id}`, { papeis: [] }),

  remove: (id: string): Promise<void> =>
    http.delete(`/usuarios/${id}`),

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  marcarOnboardingConcluido: (id: string): Promise<void> =>
    http.patch(`/usuarios/${id}`, { onboardingConcluido: true } as any),
};
