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

  listarComVinculos: async () => { throw new Error('[sem endpoint NestJS] operacoes.listarComVinculos'); },

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

  resolverStatusItem: async () => { throw new Error('[sem endpoint NestJS] operacoes.resolverStatusItem'); },
  ensureEmAndamento: async () => { throw new Error('[sem endpoint NestJS] operacoes.ensureEmAndamento'); },
  upsert: async () => { throw new Error('[sem endpoint NestJS] operacoes.upsert'); },
  bulkInsert: async () => { throw new Error('[sem endpoint NestJS] operacoes.bulkInsert'); },
  listExistingItemIds: async () => { throw new Error('[sem endpoint NestJS] operacoes.listExistingItemIds'); },
  concluirParaItem: async () => { throw new Error('[sem endpoint NestJS] operacoes.concluirParaItem'); },
};

export const operacoesSla = {
  addEvidencia: (
    operacaoId: string,
    imageUrl: string,
    legenda: string | null,
  ): Promise<void> =>
    http.post(`/operacoes/${operacaoId}/evidencias`, { imageUrl, legenda }),
  ensureAndConcluir: async () => { throw new Error('[sem endpoint NestJS] operacoesSla.ensureAndConcluir'); },
};
