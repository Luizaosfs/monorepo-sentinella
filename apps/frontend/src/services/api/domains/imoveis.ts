import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToCamel, deepToSnake, type Ret } from '../shared/case-mappers';

export const imoveis = {
  list: async (
    clienteId: string,
    regiaoId?: string,
  ): Promise<Ret<typeof _sb.imoveis.list>> => {
    const raw = await http.get(`/imoveis${qs({ clienteId, regiaoId, ativo: true })}`);
    return deepToSnake(raw) as Ret<typeof _sb.imoveis.list>;
  },

  create: async (
    payload: Parameters<typeof _sb.imoveis.create>[0],
  ): Promise<Ret<typeof _sb.imoveis.create>> => {
    const raw = await http.post('/imoveis', deepToCamel(payload));
    return deepToSnake(raw) as Ret<typeof _sb.imoveis.create>;
  },

  update: (
    id: string,
    payload: Parameters<typeof _sb.imoveis.update>[1],
  ): Promise<void> =>
    http.put(`/imoveis/${id}`, deepToCamel(payload)),

  marcarPrioridadeDrone: (imovelId: string, valor: boolean): Promise<void> =>
    http.put(`/imoveis/${imovelId}`, { prioridadeDrone: valor }),

  atualizarPerfil: (
    imovelId: string,
    payload: Parameters<typeof _sb.imoveis.atualizarPerfil>[1],
  ): Promise<void> =>
    http.put(`/imoveis/${imovelId}`, deepToCamel(payload)),

  listResumo: async (
    _clienteId: string,
    regiaoId?: string,
  ): Promise<Ret<typeof _sb.imoveis.listResumo>> => {
    const raw = await http.get(`/imoveis/resumo${qs({ regiaoId })}`);
    return deepToSnake(raw) as Ret<typeof _sb.imoveis.listResumo>;
  },

  getResumoById: async (id: string): Promise<Ret<typeof _sb.imoveis.getResumoById>> => {
    const raw = await http.get(`/imoveis/${id}/resumo`);
    return deepToSnake(raw) as Ret<typeof _sb.imoveis.getResumoById>;
  },

  listProblematicos: async (
    _clienteId: string,
  ): Promise<Ret<typeof _sb.imoveis.listProblematicos>> => {
    const raw = await http.get('/imoveis/problematicos');
    return deepToSnake(raw) as Ret<typeof _sb.imoveis.listProblematicos>;
  },

  findByEndereco: async () => { throw new Error('[sem endpoint NestJS] imoveis.findByEndereco'); },
  countPrioridadeDroneByCliente: async () => { throw new Error('[sem endpoint NestJS] imoveis.countPrioridadeDroneByCliente'); },
  buscarChavesExistentes: async () => { throw new Error('[sem endpoint NestJS] imoveis.buscarChavesExistentes'); },
  batchCreate: async () => { throw new Error('[sem endpoint NestJS] imoveis.batchCreate'); },
};
