import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToCamel, deepToSnake, type Ret } from '../shared/case-mappers';

export const planoAcaoCatalogo = {
  /**
   * Lista ações ativas do cliente, ordenadas por ordem.
   * tipoItem opcional: backend recebe o valor e filtra; atenção ao risco de
   * que o backend use igualdade estrita (tipo_item=X) enquanto o Supabase
   * usava OR(tipo_item=X, tipo_item is null) — genéricas podem sumir.
   */
  listByCliente: async (
    clienteId: string,
    tipoItem?: string | null,
  ): Promise<Ret<typeof _sb.planoAcaoCatalogo.listByCliente>> => {
    try {
      const raw = await http.get(`/plano-acao${qs({ clienteId, tipoItem })}`);
      return deepToSnake(raw) as Ret<typeof _sb.planoAcaoCatalogo.listByCliente>;
    } catch { return _sb.planoAcaoCatalogo.listByCliente(clienteId, tipoItem); }
  },

  /** Lista todas as ações incluindo inativas (admin). */
  listAllByCliente: async (
    clienteId: string,
  ): Promise<Ret<typeof _sb.planoAcaoCatalogo.listAllByCliente>> => {
    try {
      const raw = await http.get(`/plano-acao/all${qs({ clienteId })}`);
      return deepToSnake(raw) as Ret<typeof _sb.planoAcaoCatalogo.listAllByCliente>;
    } catch { return _sb.planoAcaoCatalogo.listAllByCliente(clienteId); }
  },

  /** Cria item no catálogo. Payload snake_case → camelCase. Resposta → snake_case. */
  create: async (
    payload: Parameters<typeof _sb.planoAcaoCatalogo.create>[0],
  ): Promise<Ret<typeof _sb.planoAcaoCatalogo.create>> => {
    try {
      const raw = await http.post('/plano-acao', deepToCamel(payload));
      return deepToSnake(raw) as Ret<typeof _sb.planoAcaoCatalogo.create>;
    } catch { return _sb.planoAcaoCatalogo.create(payload); }
  },

  /** Atualiza item do catálogo. Payload snake_case → camelCase → PUT /plano-acao/:id. */
  update: async (
    id: string,
    payload: Parameters<typeof _sb.planoAcaoCatalogo.update>[1],
  ): Promise<void> => {
    try { await http.put(`/plano-acao/${id}`, deepToCamel(payload)); }
    catch { await _sb.planoAcaoCatalogo.update(id, payload); }
  },

  /** Remove item do catálogo. */
  remove: async (id: string): Promise<void> => {
    try { await http.delete(`/plano-acao/${id}`); }
    catch { await _sb.planoAcaoCatalogo.remove(id); }
  },
};
