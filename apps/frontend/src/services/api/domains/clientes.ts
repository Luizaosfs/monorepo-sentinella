import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToCamel, deepToSnake, type Ret } from '../shared/case-mappers';

export const clientes = {
  list: async (): Promise<Ret<typeof _sb.clientes.list>> => {
    const raw = await http.get(`/clientes${qs({ ativo: true })}`);
    return deepToSnake(raw) as Ret<typeof _sb.clientes.list>;
  },

  listAll: async (): Promise<Ret<typeof _sb.clientes.listAll>> => {
    const raw = await http.get('/clientes');
    return deepToSnake(raw) as Ret<typeof _sb.clientes.listAll>;
  },

  me: async (): Promise<Ret<typeof _sb.clientes.getById>> => {
    const raw = await http.get('/clientes/me') as Record<string, unknown> | null;
    if (!raw) return null;
    return deepToSnake(raw) as Ret<typeof _sb.clientes.getById>;
  },

  getById: async (id: string): Promise<Ret<typeof _sb.clientes.getById>> => {
    const raw = await http.get(`/clientes/${id}`) as Record<string, unknown>;
    if (!raw) return null;
    return { id: raw.id as string, nome: raw.nome as string };
  },

  getConfig: async (_id?: string): Promise<Ret<typeof _sb.clientes.getConfig>> => {
    const raw = await http.get('/clientes/me') as Record<string, unknown>;
    if (!raw) return null;
    const snake = deepToSnake(raw) as Record<string, unknown>;
    return {
      id: snake.id as string,
      uf: snake.uf as string | null,
      ibge_municipio: snake.ibge_municipio as string | null,
    };
  },

  create: async (
    payload: Parameters<typeof _sb.clientes.create>[0],
  ): Promise<Ret<typeof _sb.clientes.create>> => {
    const raw = await http.post('/clientes', deepToCamel(payload));
    return deepToSnake(raw) as Ret<typeof _sb.clientes.create>;
  },

  update: (
    id: string,
    payload: Parameters<typeof _sb.clientes.update>[1],
  ): Promise<void> =>
    http.put(`/clientes/${id}`, deepToCamel(payload)),

  resolverPorCoordenada: (lat: number, lng: number) =>
    http.get(`/clientes/resolver-coordenada${qs({ lat, lng })}`),

  resolverPorCoordenadaPublico: (lat: number, lng: number) =>
    http.get<{ id: string; nome: string; cidade: string; uf: string; slug: string; metodo: string } | null>(
      `/clientes/resolver-coordenada-cidadao${qs({ lat, lng })}`
    ),
};

export const regioes = {
  listByCliente: async (clienteId: string): Promise<Ret<typeof _sb.regioes.listByCliente>> => {
    const raw = await http.get(`/regioes${qs({ clienteId })}`);
    const arr = (Array.isArray(raw) ? raw : [raw]) as Record<string, unknown>[];
    return deepToSnake(arr.map((r) => ({ ...r, regiao: r.nome ?? r.regiao }))) as Ret<typeof _sb.regioes.listByCliente>;
  },
  listAll: async (): Promise<Ret<typeof _sb.regioes.listAll>> => {
    const raw = await http.get('/regioes');
    const arr = (Array.isArray(raw) ? raw : [raw]) as Record<string, unknown>[];
    return deepToSnake(arr.map((r) => ({ ...r, regiao: r.nome ?? r.regiao }))) as Ret<typeof _sb.regioes.listAll>;
  },
  create: async (payload: Parameters<typeof _sb.regioes.create>[0]): Promise<Ret<typeof _sb.regioes.create>> => {
    const raw = await http.post('/regioes', deepToCamel(payload)) as Record<string, unknown>;
    return (raw?.id ?? raw) as Ret<typeof _sb.regioes.create>;
  },
  update: (id: string, payload: Parameters<typeof _sb.regioes.update>[1]): Promise<void> =>
    http.put(`/regioes/${id}`, deepToCamel(payload)),
  remove: (id: string): Promise<void> =>
    http.delete(`/regioes/${id}`),
  bulkInsert: (rows: Record<string, unknown>[]): Promise<{ count: number }> =>
    http.post('/regioes/bulk-insert', { rows }),
};
