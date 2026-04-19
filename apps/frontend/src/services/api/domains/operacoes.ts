import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToSnake, type Ret } from '../shared/case-mappers';

export const operacoes = {
  statsByCliente: async (clienteId: string): Promise<Ret<typeof _sb.operacoes.statsByCliente>> => {
    const raw = await http.get(`/operacoes/stats${qs({ clienteId })}`);
    return deepToSnake(raw) as Ret<typeof _sb.operacoes.statsByCliente>;
  },

  listByFoco: async (focoRiscoId: string): Promise<Ret<typeof _sb.operacoes.listByFoco>> => {
    const raw = await http.get(`/operacoes${qs({ focoRiscoId })}`);
    return deepToSnake(raw) as Ret<typeof _sb.operacoes.listByFoco>;
  },

  listarComVinculos: (filters?: { status?: string; tipoVinculo?: string; focoRiscoId?: string; limit?: number }): Promise<Record<string, unknown>[]> =>
    http.get(`/operacoes/com-vinculos${qs(filters ?? {})}`),

  cancelar: (id: string): Promise<void> =>
    http.delete(`/operacoes/${id}`),

  criarParaItem: (
    params: Parameters<typeof _sb.operacoes.criarParaItem>[0],
  ): Promise<void> =>
    http.post('/operacoes/criar-para-item', {
      itemLevantamentoId: params.itemLevantamentoId,
      prioridade: params.prioridade,
      observacao: params.observacao,
    }),

  enviarEquipeParaItem: (
    params: Parameters<typeof _sb.operacoes.enviarEquipeParaItem>[0],
  ): Promise<void> =>
    http.post('/operacoes/enviar-equipe', {
      itemLevantamentoId: params.itemLevantamentoId,
      responsavelId: params.responsavelId,
      prioridade: params.prioridade,
      observacao: params.observacao,
      status: 'em_andamento',
      tipoVinculo: 'levantamento',
    }),

  atualizarStatus: (id: string, newStatus: string): Promise<void> =>
    http.put(`/operacoes/${id}`, { status: newStatus }),

  remover: (id: string): Promise<void> =>
    http.delete(`/operacoes/${id}`),

  resolverStatusItem: (itemId: string): Promise<void> =>
    http.post('/operacoes/resolver-status-item', { itemId }),
  ensureEmAndamento: (
    _clienteId: string,
    itemLevantamentoId?: string,
    focoRiscoId?: string,
    opts?: { responsavelId?: string; prioridade?: string; observacao?: string; tipoVinculo?: string },
  ): Promise<Record<string, unknown>> =>
    http.post('/operacoes/ensure-em-andamento', { itemLevantamentoId, focoRiscoId, ...opts }),

  upsert: (body: { id?: string; status: string; prioridade?: string | null; responsavelId?: string | null; observacao?: string | null; prevStatus?: string }): Promise<Record<string, unknown>> =>
    http.post('/operacoes/upsert', body),

  bulkInsert: (operacoes: Array<{ itemLevantamentoId: string; status?: string; prioridade?: string | null; responsavelId?: string | null; observacao?: string | null; tipoVinculo?: string }>): Promise<{ operacoes: Record<string, unknown>[]; skipped: number }> =>
    http.post('/operacoes/bulk-insert', { operacoes }),

  listExistingItemIds: (_clienteId: string, itemIds: string[]): Promise<string[]> =>
    http.post('/operacoes/existing-item-ids', { itemIds }),
  concluirParaItem: (itemLevantamentoId: string, observacao?: string): Promise<Record<string, unknown>> =>
    http.post('/operacoes/concluir-para-item', { itemLevantamentoId, observacao }),
};

export const operacoesSla = {
  addEvidencia: (
    operacaoId: string,
    imageUrl: string,
    legenda: string | null,
  ): Promise<void> =>
    http.post(`/operacoes/${operacaoId}/evidencias`, { imageUrl, legenda }),
  ensureAndConcluir: (opts: { itemLevantamentoId?: string; focoRiscoId?: string; responsavelId?: string | null; prioridade?: string | null; observacao?: string | null; tipoVinculo?: string }): Promise<Record<string, unknown>> =>
    http.post('/operacoes/ensure-and-concluir', opts),
};
