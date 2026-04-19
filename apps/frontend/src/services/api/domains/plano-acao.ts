import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToCamel, deepToSnake, type Ret } from '../shared/case-mappers';

export const planoAcaoCatalogo = {
  listByCliente: async (
    clienteId: string,
    tipoItem?: string | null,
  ): Promise<Ret<typeof _sb.planoAcaoCatalogo.listByCliente>> => {
    const raw = await http.get(`/plano-acao${qs({ clienteId, tipoItem })}`);
    return deepToSnake(raw) as Ret<typeof _sb.planoAcaoCatalogo.listByCliente>;
  },

  listAllByCliente: async (
    clienteId: string,
  ): Promise<Ret<typeof _sb.planoAcaoCatalogo.listAllByCliente>> => {
    const raw = await http.get(`/plano-acao/all${qs({ clienteId })}`);
    return deepToSnake(raw) as Ret<typeof _sb.planoAcaoCatalogo.listAllByCliente>;
  },

  create: async (
    payload: Parameters<typeof _sb.planoAcaoCatalogo.create>[0],
  ): Promise<Ret<typeof _sb.planoAcaoCatalogo.create>> => {
    const raw = await http.post('/plano-acao', deepToCamel(payload));
    return deepToSnake(raw) as Ret<typeof _sb.planoAcaoCatalogo.create>;
  },

  update: (
    id: string,
    payload: Parameters<typeof _sb.planoAcaoCatalogo.update>[1],
  ): Promise<void> =>
    http.put(`/plano-acao/${id}`, deepToCamel(payload)),

  remove: (id: string): Promise<void> =>
    http.delete(`/plano-acao/${id}`),
};
