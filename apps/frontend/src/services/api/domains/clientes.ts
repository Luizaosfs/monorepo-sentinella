import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToCamel, deepToSnake, type Ret } from '../shared/case-mappers';

export const clientes = {
  /**
   * Lista clientes ativos (ativo=true). Resposta camelCase → snake_case.
   */
  list: async (): Promise<Ret<typeof _sb.clientes.list>> => {
    const raw = await http.get(`/clientes${qs({ ativo: true })}`);
    return deepToSnake(raw) as Ret<typeof _sb.clientes.list>;
  },

  /**
   * Lista todos os clientes incluindo inativos (para admin).
   */
  listAll: async (): Promise<Ret<typeof _sb.clientes.listAll>> => {
    const raw = await http.get('/clientes');
    return deepToSnake(raw) as Ret<typeof _sb.clientes.listAll>;
  },

  /**
   * Retorna o cliente vinculado ao usuário autenticado (não-admin).
   */
  me: async (): Promise<Ret<typeof _sb.clientes.getById>> => {
    const raw = await http.get('/clientes/me') as Record<string, unknown> | null;
    if (!raw) return null;
    return deepToSnake(raw) as Ret<typeof _sb.clientes.getById>;
  },

  /**
   * Retorna id e nome de um cliente.
   */
  getById: async (id: string): Promise<Ret<typeof _sb.clientes.getById>> => {
    const raw = await http.get(`/clientes/${id}`) as Record<string, unknown>;
    if (!raw) return null;
    // Backend retorna camelCase; pegamos id (invariante) e nome antes de converter
    return { id: raw.id as string, nome: raw.nome as string };
  },

  /**
   * Retorna campos de configuração UF/IBGE do cliente.
   */
  getConfig: async (id: string): Promise<Ret<typeof _sb.clientes.getConfig>> => {
    const raw = await http.get(`/clientes/${id}`) as Record<string, unknown>;
    if (!raw) return null;
    const snake = deepToSnake(raw) as Record<string, unknown>;
    return {
      id: snake.id as string,
      uf: snake.uf as string | null,
      ibge_municipio: snake.ibge_municipio as string | null,
    };
  },

  /** Cria cliente. Payload snake_case → camelCase. Resposta camelCase → snake_case. */
  create: async (
    payload: Parameters<typeof _sb.clientes.create>[0],
  ): Promise<Ret<typeof _sb.clientes.create>> => {
    const raw = await http.post('/clientes', deepToCamel(payload));
    return deepToSnake(raw) as Ret<typeof _sb.clientes.create>;
  },

  /** Atualiza cliente parcialmente. Payload snake_case → camelCase → PUT /clientes/:id. */
  update: async (
    id: string,
    payload: Parameters<typeof _sb.clientes.update>[1],
  ): Promise<void> => {
    await http.put(`/clientes/${id}`, deepToCamel(payload));
  },

  /**
   * @fallback Usado pelo portal público /denunciar (sem autenticação).
   * O endpoint NestJS GET /clientes/resolver-coordenada tem AuthGuard → não serve para público.
   * Mantido no Supabase.
   */
  resolverPorCoordenada: _sb.clientes.resolverPorCoordenada.bind(_sb.clientes),
};

export const regioes = {
  /** Lista regiões do cliente. Adapta nome→regiao para compatibilidade. */
  listByCliente: async (clienteId: string): Promise<Ret<typeof _sb.regioes.listByCliente>> => {
    try {
      const raw = await http.get(`/regioes${qs({ clienteId })}`);
      const arr = (Array.isArray(raw) ? raw : [raw]) as Record<string, unknown>[];
      return deepToSnake(arr.map((r) => ({ ...r, regiao: r.nome ?? r.regiao }))) as Ret<typeof _sb.regioes.listByCliente>;
    } catch { return _sb.regioes.listByCliente(clienteId); }
  },
  /** Lista todas as regiões (admin). */
  listAll: async (): Promise<Ret<typeof _sb.regioes.listAll>> => {
    try {
      const raw = await http.get('/regioes');
      const arr = (Array.isArray(raw) ? raw : [raw]) as Record<string, unknown>[];
      return deepToSnake(arr.map((r) => ({ ...r, regiao: r.nome ?? r.regiao }))) as Ret<typeof _sb.regioes.listAll>;
    } catch { return _sb.regioes.listAll(); }
  },
  /** Cria região. Retorna id (string) extraído do objeto retornado pelo backend. */
  create: async (payload: Parameters<typeof _sb.regioes.create>[0]): Promise<Ret<typeof _sb.regioes.create>> => {
    try {
      const raw = await http.post('/regioes', deepToCamel(payload)) as Record<string, unknown>;
      return (raw?.id ?? raw) as Ret<typeof _sb.regioes.create>;
    } catch { return _sb.regioes.create(payload); }
  },
  /** Atualiza região. */
  update: async (id: string, payload: Parameters<typeof _sb.regioes.update>[1]): Promise<void> => {
    try { await http.put(`/regioes/${id}`, deepToCamel(payload)); }
    catch { return _sb.regioes.update(id, payload); }
  },
  remove: async (id: string): Promise<void> => {
    try { await http.delete(`/regioes/${id}`); }
    catch { return _sb.regioes.remove(id); }
  },
  /** @fallback Sem endpoint de bulk insert no backend. */
  bulkInsert: _sb.regioes.bulkInsert.bind(_sb.regioes),
};
