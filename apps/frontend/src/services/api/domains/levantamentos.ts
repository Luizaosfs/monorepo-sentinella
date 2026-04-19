import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToCamel, deepToSnake, type Ret } from '../shared/case-mappers';

export const levantamentos = {
  /**
   * Lista levantamentos do cliente com filtros opcionais.
   * Resposta NestJS (camelCase) → convertida para snake_case (database.ts).
   */
  list: async (
    clienteId: string,
    filtros?: Parameters<typeof _sb.levantamentos.list>[1],
  ): Promise<Ret<typeof _sb.levantamentos.list>> => {
    try {
      const raw = await http.get(`/levantamentos${qs({ clienteId, ...filtros })}`);
      return deepToSnake(raw) as Ret<typeof _sb.levantamentos.list>;
    } catch {
      return _sb.levantamentos.list(clienteId);
    }
  },

  /**
   * Atualiza o planejamento_id de um levantamento.
   */
  updatePlanejamento: async (levId: string, planejamentoId: string): Promise<void> => {
    try {
      return await http.put(`/levantamentos/${levId}`, { planejamentoId });
    } catch {
      return _sb.levantamentos.updatePlanejamento(levId, planejamentoId);
    }
  },

  /** Busca levantamento por ID. */
  getById: async (id: string): Promise<Ret<typeof _sb.levantamentos.getById>> => {
    try {
      const raw = await http.get(`/levantamentos/${id}`);
      return deepToSnake(raw) as Ret<typeof _sb.levantamentos.getById>;
    } catch { return _sb.levantamentos.getById(id); }
  },

  /** Cria levantamento. */
  create: async (payload: Parameters<typeof _sb.levantamentos.create>[0]): Promise<Ret<typeof _sb.levantamentos.create>> => {
    try {
      const raw = await http.post('/levantamentos', deepToCamel(payload));
      return deepToSnake(raw) as Ret<typeof _sb.levantamentos.create>;
    } catch { return _sb.levantamentos.create(payload); }
  },

  /** Atualiza levantamento. */
  update: async (id: string, payload: Parameters<typeof _sb.levantamentos.update>[1]): Promise<void> => {
    try { await http.put(`/levantamentos/${id}`, deepToCamel(payload)); }
    catch { return _sb.levantamentos.update(id, payload); }
  },

  /** Lista levantamentos de um planejamento. */
  listByPlanejamento: async (planejamentoId: string): Promise<Ret<typeof _sb.levantamentos.listByPlanejamento>> => {
    try {
      const raw = await http.get(`/levantamentos${qs({ planejamentoId })}`);
      return deepToSnake(raw) as Ret<typeof _sb.levantamentos.listByPlanejamento>;
    } catch { return _sb.levantamentos.listByPlanejamento?.(planejamentoId); }
  },

  // ── Fallback Supabase ──────────────────────────────────────────────────
  /** @fallback Configuração de fonte: sem endpoint NestJS equivalente. */
  listConfigFonteMap: _sb.levantamentos.listConfigFonteMap.bind(_sb.levantamentos),
  delete: async (id: string): Promise<void> => {
    try { await http.delete(`/levantamentos/${id}`); }
    catch { return _sb.levantamentos.delete?.(id); }
  },
};

export const itens = {
  /**
   * Cria item manual via RPC substituída pelo endpoint NestJS.
   * Params: snake_case (frontend) → deepToCamel → backend DTO (camelCase).
   * Resposta: camelCase → deepToSnake → snake_case (database.ts).
   */
  criarManual: async (
    params: Parameters<typeof _sb.itens.criarManual>[0],
  ): Promise<Ret<typeof _sb.itens.criarManual>> => {
    try {
      const body = deepToCamel(params);
      const raw = await http.post('/levantamentos/item-manual', body);
      return deepToSnake(raw) as Ret<typeof _sb.itens.criarManual>;
    } catch {
      return _sb.itens.criarManual(params);
    }
  },

  /** Lista itens de um levantamento. */
  listByLevantamento: async (levantamentoId: string): Promise<Ret<typeof _sb.itens.listByLevantamento>> => {
    try {
      const raw = await http.get(`/levantamentos/${levantamentoId}/itens`);
      return deepToSnake(raw) as Ret<typeof _sb.itens.listByLevantamento>;
    } catch { return _sb.itens.listByLevantamento(levantamentoId); }
  },

  // ── Fallback Supabase ──────────────────────────────────────────────────
  /** @fallback updateAtendimento é no-op legado. */
  updateAtendimento: _sb.itens.updateAtendimento.bind(_sb.itens),
  getById: async (id: string) => {
    try {
      const raw = await http.get(`/levantamentos/itens/${id}`);
      return deepToSnake(raw) as Ret<typeof _sb.itens.getById>;
    } catch { return _sb.itens.getById?.(id); }
  },
  update: async (id: string, payload: Parameters<NonNullable<typeof _sb.itens.update>>[1]) => {
    try { await http.put(`/levantamentos/itens/${id}`, deepToCamel(payload)); }
    catch { return _sb.itens.update?.(id, payload); }
  },
  delete: async (id: string) => {
    try { await http.delete(`/levantamentos/itens/${id}`); }
    catch { return _sb.itens.delete?.(id); }
  },
  addEvidencia: async (itemId: string, payload: Parameters<NonNullable<typeof _sb.itens.addEvidencia>>[1]) => {
    try {
      const raw = await http.post(`/levantamentos/itens/${itemId}/evidencias`, deepToCamel(payload));
      return deepToSnake(raw) as Ret<typeof _sb.itens.addEvidencia>;
    } catch { return _sb.itens.addEvidencia?.(itemId, payload); }
  },
  /** @fallback listByFoco: join via foco_risco sem campo direto no item — usa Supabase. */
  listByFoco: _sb.itens.listByFoco?.bind(_sb.itens),
  /** @fallback Métodos analíticos e de enriquecimento: sem endpoint NestJS. */
  listByCliente: _sb.itens.listByCliente.bind(_sb.itens),
  countStatusAtendimentoByCliente: _sb.itens.countStatusAtendimentoByCliente.bind(_sb.itens),
  listRecentResolvidosPorCliente: _sb.itens.listRecentResolvidosPorCliente.bind(_sb.itens),
  listDetecoes: _sb.itens.listDetecoes.bind(_sb.itens),
  getDetectionBbox: _sb.itens.getDetectionBbox.bind(_sb.itens),
  registrarCheckin: _sb.itens.registrarCheckin.bind(_sb.itens),
  listByOperador: _sb.itens.listByOperador.bind(_sb.itens),
  listMapByCliente: _sb.itens.listMapByCliente.bind(_sb.itens),
  updateObservacaoAtendimento: _sb.itens.updateObservacaoAtendimento.bind(_sb.itens),
  listStatusHistorico: _sb.itens.listStatusHistorico.bind(_sb.itens),
  listByClienteAndPeriod: _sb.itens.listByClienteAndPeriod.bind(_sb.itens),
};
