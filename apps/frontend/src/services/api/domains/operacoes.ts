import { http } from '@sentinella/api-client';
import { logFallback } from '@/lib/fallbackLogger';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToSnake, type Ret } from '../shared/case-mappers';

export const operacoes = {
  /**
   * Stats por status do cliente via GET /operacoes/stats.
   * Backend retorna { byStatus: Record<string,number> }; fallback se shape diferente.
   */
  statsByCliente: async (clienteId: string): Promise<Ret<typeof _sb.operacoes.statsByCliente>> => {
    try {
      const raw = await http.get(`/operacoes/stats${qs({ clienteId })}`);
      return deepToSnake(raw) as Ret<typeof _sb.operacoes.statsByCliente>;
    } catch { return _sb.operacoes.statsByCliente(clienteId); }
  },

  /**
   * Lista operações de um foco via GET /operacoes?focoRiscoId.
   * Fallback se join evidências ausente.
   */
  listByFoco: async (focoRiscoId: string): Promise<Ret<typeof _sb.operacoes.listByFoco>> => {
    try {
      const raw = await http.get(`/operacoes${qs({ focoRiscoId })}`);
      return deepToSnake(raw) as Ret<typeof _sb.operacoes.listByFoco>;
    } catch { return _sb.operacoes.listByFoco(focoRiscoId); }
  },

  /**
   * @fallback vinculo_nome resolvido via 3 joins no Supabase; backend não retorna esse campo.
   * Mantido em Supabase.
   */
  listarComVinculos: _sb.operacoes.listarComVinculos.bind(_sb.operacoes),

  /** Cancela (soft delete) operação. */
  cancelar: async (id: string): Promise<void> => {
    try {
      return await http.delete(`/operacoes/${id}`);
    } catch (err) {
      logFallback('operacoes', 'cancelar', err, `DELETE /operacoes/${id}`);
      return _sb.operacoes.cancelar(id);
    }
  },

  /** Cria operação vinculada a item de levantamento (verifica duplicata). */
  criarParaItem: async (
    params: Parameters<typeof _sb.operacoes.criarParaItem>[0],
  ): Promise<void> => {
    try {
      return await http.post('/operacoes/criar-para-item', {
        itemLevantamentoId: params.itemLevantamentoId,
        prioridade: params.prioridade,
        observacao: params.observacao,
      });
    } catch {
      return _sb.operacoes.criarParaItem(params);
    }
  },

  /** Envia equipe para item — cria operação em andamento com responsável. */
  enviarEquipeParaItem: async (
    params: Parameters<typeof _sb.operacoes.enviarEquipeParaItem>[0],
  ): Promise<void> => {
    try {
      return await http.post('/operacoes/enviar-equipe', {
        itemLevantamentoId: params.itemLevantamentoId,
        responsavelId: params.responsavelId,
        prioridade: params.prioridade,
        observacao: params.observacao,
        status: 'em_andamento',
        tipoVinculo: 'levantamento',
      });
    } catch {
      return _sb.operacoes.enviarEquipeParaItem(params);
    }
  },

  /** Atualiza status de uma operação. Fallback cobre statuses fora do enum do backend. */
  atualizarStatus: async (id: string, newStatus: string): Promise<void> => {
    try {
      return await http.put(`/operacoes/${id}`, { status: newStatus });
    } catch {
      return _sb.operacoes.atualizarStatus(id, newStatus);
    }
  },

  /** Remove (soft delete) uma operação. */
  remover: async (id: string): Promise<void> => {
    try {
      return await http.delete(`/operacoes/${id}`);
    } catch {
      return _sb.operacoes.remover(id);
    }
  },

  /** Resolve item de foco via transição de estado (já migrado em focosRisco). */
  resolverStatusItem: _sb.operacoes.resolverStatusItem.bind(_sb.operacoes),

  // ── Fallback Supabase — sem endpoint NestJS equivalente ────────────────
  /** @fallback Upsert complexo (ensure + update): sem endpoint NestJS. */
  ensureEmAndamento: _sb.operacoes.ensureEmAndamento.bind(_sb.operacoes),
  /** @fallback Upsert genérico: sem endpoint NestJS. */
  upsert: _sb.operacoes.upsert.bind(_sb.operacoes),
  /** @fallback Bulk insert (pipeline drone): sem endpoint NestJS. */
  bulkInsert: _sb.operacoes.bulkInsert.bind(_sb.operacoes),
  /** @fallback Filtra IDs com operação aberta (pipeline drone): sem endpoint NestJS. */
  listExistingItemIds: _sb.operacoes.listExistingItemIds.bind(_sb.operacoes),
  /** @fallback Remoção direta: sem endpoint NestJS (use remover() para soft delete). */
  concluirParaItem: _sb.operacoes.concluirParaItem.bind(_sb.operacoes),
};

export const operacoesSla = {
  /** Adiciona evidência fotográfica a uma operação. */
  addEvidencia: async (
    operacaoId: string,
    imageUrl: string,
    legenda: string | null,
  ): Promise<void> => {
    try {
      return await http.post(`/operacoes/${operacaoId}/evidencias`, { imageUrl, legenda });
    } catch {
      return _sb.operacoesSla.addEvidencia(operacaoId, imageUrl, legenda);
    }
  },

  /** @fallback Upsert + conclude: lógica composta sem endpoint direto no NestJS. */
  ensureAndConcluir: _sb.operacoesSla.ensureAndConcluir.bind(_sb.operacoesSla),
};
