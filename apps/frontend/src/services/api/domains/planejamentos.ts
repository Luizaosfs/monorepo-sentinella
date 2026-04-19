import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToCamel, deepToSnake, type Ret } from '../shared/case-mappers';

export const planejamentos = {
  listByCliente: async (
    clienteId: string,
  ): Promise<Ret<typeof _sb.planejamentos.listByCliente>> => {
    const raw = await http.get(`/planejamentos${qs({ clienteId })}`);
    return deepToSnake(raw) as Ret<typeof _sb.planejamentos.listByCliente>;
  },

  listAtivosByCliente: async (
    clienteId: string,
  ): Promise<Ret<typeof _sb.planejamentos.listAtivosByCliente>> => {
    const raw = await http.get(`/planejamentos/ativos${qs({ clienteId })}`);
    return deepToSnake(raw) as Ret<typeof _sb.planejamentos.listAtivosByCliente>;
  },

  listAtivosManuaisByCliente: async (
    clienteId: string,
  ): Promise<Ret<typeof _sb.planejamentos.listAtivosManuaisByCliente>> => {
    const raw = await http.get(`/planejamentos/ativos-manuais${qs({ clienteId })}`);
    return deepToSnake(raw) as Ret<typeof _sb.planejamentos.listAtivosManuaisByCliente>;
  },

  upsert: async (payload: Record<string, unknown>, id?: string): Promise<void> => {
    const body = deepToCamel(payload) as Record<string, unknown>;
    if (id) {
      await http.put(`/planejamentos/${id}`, body);
    } else {
      await http.post('/planejamentos', body);
    }
  },

  remove: (id: string): Promise<void> =>
    http.delete(`/planejamentos/${id}`),

  listWithClienteByCliente: async (clienteId?: string) => {
    const raw = await http.get(`/planejamentos/with-cliente${qs({ clienteId })}`);
    return deepToSnake(raw) as Ret<typeof _sb.planejamentos.listWithClienteByCliente>;
  },
  voosByPlanejamento: (planejamentoId: string) =>
    http.get(`/planejamentos/${planejamentoId}/voos`),
};

export const ciclos = {
  listHistorico: async (
    clienteId: string,
  ): Promise<Ret<typeof _sb.ciclos.listHistorico>> => {
    const raw = await http.get(`/ciclos${qs({ clienteId })}`);
    return deepToSnake(raw) as Ret<typeof _sb.ciclos.listHistorico>;
  },

  abrir: async (
    clienteId: string,
    params: Parameters<typeof _sb.ciclos.abrir>[1],
  ): Promise<Ret<typeof _sb.ciclos.abrir>> => {
    const body = deepToCamel({
      cliente_id: clienteId,
      ...params,
    }) as Record<string, unknown>;
    const raw = await http.post('/ciclos/abrir', body);
    return deepToSnake(raw) as Ret<typeof _sb.ciclos.abrir>;
  },

  fechar: async (
    clienteId: string,
    params: Parameters<typeof _sb.ciclos.fechar>[1],
  ): Promise<Ret<typeof _sb.ciclos.fechar>> => {
    const body = deepToCamel({
      cliente_id: clienteId,
      ...params,
    }) as Record<string, unknown>;
    const raw = await http.post('/ciclos/fechar', body);
    return deepToSnake(raw) as Ret<typeof _sb.ciclos.fechar>;
  },

  getCicloAtivo: async (_clienteId: string): Promise<Ret<typeof _sb.ciclos.getCicloAtivo>> => {
    const raw = await http.get('/ciclos/ativo');
    return deepToSnake(raw) as Ret<typeof _sb.ciclos.getCicloAtivo>;
  },

  getProgresso: async (_clienteId: string): Promise<Ret<typeof _sb.ciclos.getProgresso>> => {
    const raw = await http.get('/ciclos/progresso');
    return deepToSnake(raw) as Ret<typeof _sb.ciclos.getProgresso>;
  },

  copiarDistribuicao: (clienteId: string, cicloOrigem: number, cicloDestino: number) =>
    http.post('/quarteiroes/distribuicoes/copiar', deepToCamel({ clienteId, cicloOrigem, cicloDestino })),
};
