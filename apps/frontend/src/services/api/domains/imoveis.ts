import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToCamel, deepToSnake, type Ret } from '../shared/case-mappers';

export const imoveis = {
  /**
   * Lista imóveis do cliente, filtrado por regiaoId opcional.
   * NestJS retorna camelCase → deepToSnake → Imovel[] (snake_case).
   */
  list: async (
    clienteId: string,
    regiaoId?: string,
  ): Promise<Ret<typeof _sb.imoveis.list>> => {
    const raw = await http.get(`/imoveis${qs({ clienteId, regiaoId, ativo: true })}`);
    return deepToSnake(raw) as Ret<typeof _sb.imoveis.list>;
  },

  /** Cria imóvel via NestJS. Payload snake_case → camelCase → backend. Resposta → snake_case. */
  create: async (
    payload: Parameters<typeof _sb.imoveis.create>[0],
  ): Promise<Ret<typeof _sb.imoveis.create>> => {
    const raw = await http.post('/imoveis', deepToCamel(payload));
    return deepToSnake(raw) as Ret<typeof _sb.imoveis.create>;
  },

  /** Atualiza imóvel parcialmente. Payload snake_case → camelCase → PUT /imoveis/:id. */
  update: async (
    id: string,
    payload: Parameters<typeof _sb.imoveis.update>[1],
  ): Promise<void> => {
    await http.put(`/imoveis/${id}`, deepToCamel(payload));
  },

  /** Marca/desmarca prioridade de drone. Atalho para PUT /imoveis/:id. */
  marcarPrioridadeDrone: async (imovelId: string, valor: boolean): Promise<void> => {
    await http.put(`/imoveis/${imovelId}`, { prioridadeDrone: valor });
  },

  /** Atualiza perfil do imóvel (ausência, animal, calha…). Payload snake_case → camelCase. */
  atualizarPerfil: async (
    imovelId: string,
    payload: Parameters<typeof _sb.imoveis.atualizarPerfil>[1],
  ): Promise<void> => {
    await http.put(`/imoveis/${imovelId}`, deepToCamel(payload));
  },

  /** HTTP GET /imoveis/resumo — substitui v_imovel_resumo. */
  listResumo: async (
    clienteId: string,
    regiaoId?: string,
  ): Promise<Ret<typeof _sb.imoveis.listResumo>> => {
    try {
      const raw = await http.get(`/imoveis/resumo${qs({ regiaoId })}`);
      return deepToSnake(raw) as Ret<typeof _sb.imoveis.listResumo>;
    } catch {
      return _sb.imoveis.listResumo(clienteId, regiaoId);
    }
  },

  /** HTTP GET /imoveis/:id/resumo — substitui v_imovel_resumo por id. */
  getResumoById: async (id: string): Promise<Ret<typeof _sb.imoveis.getResumoById>> => {
    try {
      const raw = await http.get(`/imoveis/${id}/resumo`);
      return deepToSnake(raw) as Ret<typeof _sb.imoveis.getResumoById>;
    } catch {
      return _sb.imoveis.getResumoById(id);
    }
  },

  /** HTTP GET /imoveis/problematicos — substitui v_imovel_historico_acesso. */
  listProblematicos: async (
    clienteId: string,
  ): Promise<Ret<typeof _sb.imoveis.listProblematicos>> => {
    try {
      const raw = await http.get('/imoveis/problematicos');
      return deepToSnake(raw) as Ret<typeof _sb.imoveis.listProblematicos>;
    } catch {
      return _sb.imoveis.listProblematicos(clienteId);
    }
  },

  /** @fallback Busca por endereço (ilike): filtro não confirmado no backend. */
  findByEndereco: _sb.imoveis.findByEndereco.bind(_sb.imoveis),
  /** @fallback Contagem prioridade drone: sem endpoint NestJS. */
  countPrioridadeDroneByCliente: _sb.imoveis.countPrioridadeDroneByCliente.bind(_sb.imoveis),
  /** @fallback Chaves existentes para deduplicação: sem endpoint NestJS. */
  buscarChavesExistentes: _sb.imoveis.buscarChavesExistentes.bind(_sb.imoveis),
  /** @fallback Importação em lote: sem endpoint NestJS. */
  batchCreate: _sb.imoveis.batchCreate.bind(_sb.imoveis),
};
