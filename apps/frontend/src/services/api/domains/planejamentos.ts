import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToCamel, deepToSnake, type Ret } from '../shared/case-mappers';

export const planejamentos = {
  /**
   * Lista todos os planejamentos do cliente (não deletados).
   * NestJS retorna camelCase → deepToSnake → Planejamento[].
   */
  listByCliente: async (
    clienteId: string,
  ): Promise<Ret<typeof _sb.planejamentos.listByCliente>> => {
    try {
      const raw = await http.get(`/planejamentos${qs({ clienteId })}`);
      return deepToSnake(raw) as Ret<typeof _sb.planejamentos.listByCliente>;
    } catch {
      return _sb.planejamentos.listByCliente(clienteId);
    }
  },

  /** Lista planejamentos ativos do cliente (ativo=true). */
  listAtivosByCliente: async (
    clienteId: string,
  ): Promise<Ret<typeof _sb.planejamentos.listAtivosByCliente>> => {
    try {
      const raw = await http.get(`/planejamentos/ativos${qs({ clienteId })}`);
      return deepToSnake(raw) as Ret<typeof _sb.planejamentos.listAtivosByCliente>;
    } catch {
      return _sb.planejamentos.listAtivosByCliente(clienteId);
    }
  },

  /** Lista planejamentos ativos com tipo MANUAL (para criar item manual). */
  listAtivosManuaisByCliente: async (
    clienteId: string,
  ): Promise<Ret<typeof _sb.planejamentos.listAtivosManuaisByCliente>> => {
    try {
      const raw = await http.get(`/planejamentos/ativos-manuais${qs({ clienteId })}`);
      return deepToSnake(raw) as Ret<typeof _sb.planejamentos.listAtivosManuaisByCliente>;
    } catch {
      return _sb.planejamentos.listAtivosManuaisByCliente(clienteId);
    }
  },

  /**
   * Cria ou atualiza um planejamento.
   * Se id fornecido → PUT /planejamentos/:id; caso contrário → POST /planejamentos.
   * Payload snake_case → deepToCamel → backend DTO.
   */
  upsert: async (payload: Record<string, unknown>, id?: string): Promise<void> => {
    try {
      const body = deepToCamel(payload) as Record<string, unknown>;
      if (id) {
        await http.put(`/planejamentos/${id}`, body);
      } else {
        await http.post('/planejamentos', body);
      }
    } catch {
      return _sb.planejamentos.upsert(payload, id);
    }
  },

  /** Remove um planejamento (soft delete). */
  remove: async (id: string): Promise<void> => {
    try {
      await http.delete(`/planejamentos/${id}`);
    } catch {
      return _sb.planejamentos.remove(id);
    }
  },

  // ── Fallback Supabase — sem endpoint NestJS equivalente ────────────────
  /** @fallback Inclui join de clientes no retorno — ViewModel não embeds cliente. */
  listWithClienteByCliente: _sb.planejamentos.listWithClienteByCliente.bind(_sb.planejamentos),
  /** @fallback Voos pertencem ao módulo drone, sem endpoint em /planejamentos. */
  voosByPlanejamento: _sb.planejamentos.voosByPlanejamento.bind(_sb.planejamentos),
};

export const ciclos = {
  /**
   * Lista histórico de ciclos do cliente (todos os ciclos, ordenados desc).
   * NestJS retorna camelCase → deepToSnake → ciclos[].
   */
  listHistorico: async (
    clienteId: string,
  ): Promise<Ret<typeof _sb.ciclos.listHistorico>> => {
    try {
      const raw = await http.get(`/ciclos${qs({ clienteId })}`);
      return deepToSnake(raw) as Ret<typeof _sb.ciclos.listHistorico>;
    } catch {
      return _sb.ciclos.listHistorico(clienteId);
    }
  },

  /**
   * Abre um ciclo bimestral via POST /ciclos/abrir.
   */
  abrir: async (
    clienteId: string,
    params: Parameters<typeof _sb.ciclos.abrir>[1],
  ): Promise<Ret<typeof _sb.ciclos.abrir>> => {
    try {
      const body = deepToCamel({
        cliente_id: clienteId,
        ...params,
      }) as Record<string, unknown>;
      const raw = await http.post('/ciclos/abrir', body);
      return deepToSnake(raw) as Ret<typeof _sb.ciclos.abrir>;
    } catch {
      return _sb.ciclos.abrir(clienteId, params);
    }
  },

  /**
   * Fecha um ciclo bimestral via POST /ciclos/fechar.
   */
  fechar: async (
    clienteId: string,
    params: Parameters<typeof _sb.ciclos.fechar>[1],
  ): Promise<Ret<typeof _sb.ciclos.fechar>> => {
    try {
      const body = deepToCamel({
        cliente_id: clienteId,
        ...params,
      }) as Record<string, unknown>;
      const raw = await http.post('/ciclos/fechar', body);
      return deepToSnake(raw) as Ret<typeof _sb.ciclos.fechar>;
    } catch {
      return _sb.ciclos.fechar(clienteId, params);
    }
  },

  /** HTTP GET /ciclos/ativo — substitui v_ciclo_ativo. */
  getCicloAtivo: async (_clienteId: string): Promise<Ret<typeof _sb.ciclos.getCicloAtivo>> => {
    try {
      const raw = await http.get('/ciclos/ativo');
      return deepToSnake(raw) as Ret<typeof _sb.ciclos.getCicloAtivo>;
    } catch {
      return _sb.ciclos.getCicloAtivo(_clienteId);
    }
  },

  /** HTTP GET /ciclos/progresso — substitui v_ciclo_progresso. */
  getProgresso: async (_clienteId: string): Promise<Ret<typeof _sb.ciclos.getProgresso>> => {
    try {
      const raw = await http.get('/ciclos/progresso');
      return deepToSnake(raw) as Ret<typeof _sb.ciclos.getProgresso>;
    } catch {
      return _sb.ciclos.getProgresso(_clienteId);
    }
  },

  /** @fallback RPC copiar_distribuicao_ciclo: sem endpoint NestJS. */
  copiarDistribuicao: _sb.ciclos.copiarDistribuicao.bind(_sb.ciclos),
};
