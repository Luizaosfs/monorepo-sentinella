import { http } from '@sentinella/api-client';
import { logFallback } from '@/lib/fallbackLogger';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToSnake, type Ret } from '../shared/case-mappers';

export const sla = {
  /** Lista todos os SLAs do cliente (pluvio + levantamento). */
  listByCliente: (clienteId: string): Promise<Ret<typeof _sb.sla.listByCliente>> =>
    http.get(`/sla${qs({ clienteId })}`),

  /** Lista SLAs para o painel com join de operador. */
  listForPanel: (clienteId: string, operadorId?: string): Promise<Ret<typeof _sb.sla.listForPanel>> =>
    http.get(`/sla/painel${qs({ clienteId, operadorId })}`),

  /** Avança status operacional (pendente → em_atendimento, etc.). */
  updateStatus: (
    slaId: string,
    updates: Parameters<typeof _sb.sla.updateStatus>[1],
  ): Promise<void> =>
    http.patch(`/sla/${slaId}/status`, updates),

  /** Reabre SLA concluído (recalcula prazo_final a partir de now()). */
  reabrir: (slaId: string): Promise<void> =>
    http.post(`/sla/${slaId}/reabrir`, {}),

  /** Conta SLAs vencidos/pendentes do cliente. */
  verificarVencidos: (clienteId: string): Promise<number> =>
    http.get(`/sla/pendentes/count${qs({ clienteId })}`),

  /** Escala prioridade de um SLA (P3→P2→P1). */
  escalar: (slaId: string): Promise<Ret<typeof _sb.sla.escalar>> =>
    http.post(`/sla/${slaId}/escalar`, {}),

  /** Conta SLAs pendentes do cliente (alias de verificarVencidos). */
  pendingCount: (clienteId: string): Promise<number> =>
    http.get(`/sla/pendentes/count${qs({ clienteId })}`),

  /** Conclui SLA manualmente. */
  concluir: (slaId: string): Promise<void> =>
    http.post(`/sla/${slaId}/concluir`, {}),

  /** Atribui operador responsável pelo SLA. */
  atribuir: (slaId: string, operadorId: string): Promise<void> =>
    http.patch(`/sla/${slaId}/atribuir`, { operadorId }),

  /** Erros de criação de SLA do cliente. */
  errosCriacao: async (clienteId: string): Promise<Ret<typeof _sb.sla.errosCriacao>> => {
    try {
      const raw = await http.get(`/sla/erros${qs({ clienteId })}`);
      return deepToSnake(raw) as Ret<typeof _sb.sla.errosCriacao>;
    } catch (err) {
      logFallback('sla', 'errosCriacao', err, '/sla/erros');
      return _sb.sla.errosCriacao(clienteId);
    }
  },
};

export const slaFeriados = {
  listByCliente: async (clienteId: string) => {
    try {
      const raw = await http.get(`/sla/feriados${qs({ clienteId })}`);
      return deepToSnake(raw) as Ret<typeof _sb.slaFeriados.listByCliente>;
    } catch { return _sb.slaFeriados.listByCliente(clienteId); }
  },
  create: async (payload: Parameters<typeof _sb.slaFeriados.create>[0]) => {
    try {
      const raw = await http.post('/sla/feriados', payload);
      return deepToSnake(raw) as Ret<typeof _sb.slaFeriados.create>;
    } catch { return _sb.slaFeriados.create(payload); }
  },
  remove: async (id: string) => {
    try { await http.delete(`/sla/feriados/${id}`); }
    catch { await _sb.slaFeriados.remove(id); }
  },
  /** @fallback RPC seed_sla_feriados_nacionais — sem endpoint NestJS. */
  seedNacionais: _sb.slaFeriados.seedNacionais.bind(_sb.slaFeriados),
};

export const slaIminentes = {
  listByCliente: async (_clienteId: string): Promise<Ret<typeof _sb.slaIminentes.listByCliente>> => {
    try {
      const raw = await http.get('/sla/iminentes');
      return deepToSnake(raw) as Ret<typeof _sb.slaIminentes.listByCliente>;
    } catch {
      return _sb.slaIminentes.listByCliente(_clienteId);
    }
  },
  countByCliente: async (_clienteId: string): Promise<Ret<typeof _sb.slaIminentes.countByCliente>> => {
    try {
      const raw = await http.get('/sla/iminentes') as unknown[];
      return (Array.isArray(raw) ? raw.length : 0) as Ret<typeof _sb.slaIminentes.countByCliente>;
    } catch {
      return _sb.slaIminentes.countByCliente(_clienteId);
    }
  },
};

export const slaConfig = {
  getByCliente: async (clienteId: string) => {
    try {
      const raw = await http.get(`/sla/config${qs({ clienteId })}`);
      return raw ? (deepToSnake(raw) as Ret<typeof _sb.slaConfig.getByCliente>) : null;
    } catch { return _sb.slaConfig.getByCliente(clienteId); }
  },
  upsert: async (clienteId: string, config: Record<string, unknown>, existingId?: string | null) => {
    try { await http.put('/sla/config', { clienteId, config, existingId }); }
    catch { await _sb.slaConfig.upsert(clienteId, config, existingId); }
  },
};

export const slaConfigRegiao = {
  listByCliente: async (clienteId: string) => {
    try {
      const raw = await http.get(`/sla/config/regioes${qs({ clienteId })}`);
      return deepToSnake(raw) as Ret<typeof _sb.slaConfigRegiao.listByCliente>;
    } catch { return _sb.slaConfigRegiao.listByCliente(clienteId); }
  },
  upsert: async (clienteId: string, regiaoId: string, config: Record<string, unknown>) => {
    try {
      const raw = await http.put(`/sla/config/regioes/${regiaoId}`, { clienteId, config });
      return deepToSnake(raw) as Ret<typeof _sb.slaConfigRegiao.upsert>;
    } catch { return _sb.slaConfigRegiao.upsert(clienteId, regiaoId, config); }
  },
  /** @fallback DELETE não implementado no backend — usa Supabase. */
  remove: _sb.slaConfigRegiao.remove.bind(_sb.slaConfigRegiao),
};

export const slaErros = {
  listByCliente: async (clienteId: string) => {
    try {
      const raw = await http.get(`/sla/erros${qs({ clienteId })}`);
      return deepToSnake(raw) as Ret<typeof _sb.slaErros.listByCliente>;
    } catch { return _sb.slaErros.listByCliente(clienteId); }
  },
};

// @fallback tabela sla_config_audit — sem endpoint NestJS
export const slaConfigAudit = {
  listByCliente: _sb.slaConfigAudit.listByCliente.bind(_sb.slaConfigAudit),
};

// @fallback view v_focos_risco_ativos — sem endpoint NestJS dedicado
export const slaInteligente = {
  listByCliente: _sb.slaInteligente.listByCliente.bind(_sb.slaInteligente),
  listCriticos: _sb.slaInteligente.listCriticos.bind(_sb.slaInteligente),
  getByFocoId: _sb.slaInteligente.getByFocoId.bind(_sb.slaInteligente),
};
