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

  listRegional: async (): Promise<{ id: string; nome: string }[]> => {
    const raw = await http.get('/clientes/regional');
    return (Array.isArray(raw) ? raw : []) as { id: string; nome: string }[];
  },

  resolverPorCoordenada: (lat: number, lng: number) =>
    http.get(`/clientes/resolver-coordenada${qs({ lat, lng })}`),

  resolverPorCoordenadaPublico: (lat: number, lng: number) =>
    http.get<{ id: string; nome: string; cidade: string; uf: string; slug: string; metodo: string } | null>(
      `/clientes/resolver-coordenada-cidadao${qs({ lat, lng })}`
    ),
};

export const regioes = {
  listByCliente: async (clienteId: string): Promise<Ret<typeof _sb.regioes.listByCliente>> => {
    const raw = await http.get(`/bairros${qs({ clienteId })}`);
    const arr = (Array.isArray(raw) ? raw : [raw]) as Record<string, unknown>[];
    return deepToSnake(arr.map((r) => ({ ...r, bairro: r.bairro ?? r.nome }))) as Ret<typeof _sb.regioes.listByCliente>;
  },
  listAll: async (): Promise<Ret<typeof _sb.regioes.listAll>> => {
    const raw = await http.get('/bairros');
    const arr = (Array.isArray(raw) ? raw : [raw]) as Record<string, unknown>[];
    return deepToSnake(arr.map((r) => ({ ...r, regiao: r.nome ?? r.regiao }))) as Ret<typeof _sb.regioes.listAll>;
  },
  create: async (payload: Parameters<typeof _sb.regioes.create>[0]): Promise<Ret<typeof _sb.regioes.create>> => {
    const p = payload as Record<string, unknown>;
    const geojson = p.area ?? p.geojson;
    const body: Record<string, unknown> = {
      nome: p.regiao ?? p.nome,
      latitude: (p.latitude as number | null | undefined) ?? null,
      longitude: (p.longitude as number | null | undefined) ?? null,
      ...(geojson != null ? { geojson } : {}),
    };
    const raw = await http.post('/bairros', body) as Record<string, unknown>;
    return (raw?.id ?? raw) as Ret<typeof _sb.regioes.create>;
  },
  update: (id: string, payload: Parameters<typeof _sb.regioes.update>[1]): Promise<void> => {
    const p = payload as Record<string, unknown>;
    const geojson = p.area ?? p.geojson;
    const body: Record<string, unknown> = {
      nome: p.regiao ?? p.nome,
      latitude: (p.latitude as number | null | undefined) ?? null,
      longitude: (p.longitude as number | null | undefined) ?? null,
      ...(geojson != null ? { geojson } : {}),
    };
    return http.put(`/bairros/${id}`, body);
  },
  remove: (id: string): Promise<void> =>
    http.delete(`/bairros/${id}`),
  bulkInsert: (rows: Record<string, unknown>[]): Promise<{ count: number }> => {
    const mapped = rows.map((r) => {
      const obj: Record<string, unknown> = { nome: r.bairro ?? r.regiao ?? r.nome };
      const lat = r.lat ?? r.latitude;
      const lon = r.lon ?? r.longitude ?? r.lng;
      if (lat != null) obj.latitude = lat;
      if (lon != null) obj.longitude = lon;
      const geojson = r.area ?? r.geojson;
      if (geojson != null) obj.geojson = geojson;
      return obj;
    });
    return http.post('/bairros/bulk-insert', { rows: mapped });
  },
  porCoordenada: (clienteId: string, lat: number, lng: number): Promise<{ bairroId: string | null }> =>
    http.get(`/bairros/por-coordenada${qs({ clienteId, lat, lng })}`),
};
