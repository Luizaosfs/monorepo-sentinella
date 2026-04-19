import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToCamel, type Ret } from '../shared/case-mappers';

export const vistorias = {
  listByAgente: (
    clienteId: string,
    agenteId: string,
    ciclo?: number,
  ): Promise<Ret<typeof _sb.vistorias.listByAgente>> =>
    http.get(`/vistorias${qs({ clienteId, agenteId, ciclo })}`),

  listByImovel: (
    imovelId: string,
    clienteId: string,
  ): Promise<Ret<typeof _sb.vistorias.listByImovel>> =>
    http.get(`/vistorias${qs({ imovelId, clienteId })}`),

  create: async (
    payload: Parameters<typeof _sb.vistorias.create>[0],
  ): Promise<Ret<typeof _sb.vistorias.create>> =>
    http.post('/vistorias', deepToCamel(payload) as Record<string, unknown>),

  updateStatus: (
    id: string,
    status: Parameters<typeof _sb.vistorias.updateStatus>[1],
  ): Promise<void> =>
    http.put(`/vistorias/${id}`, { status }),

  createCompleta: async (payload: Record<string, unknown>): Promise<string> => {
    const result = await http.post<{ id: string }>(
      '/vistorias/completa',
      deepToCamel(payload) as Record<string, unknown>,
    );
    return result.id;
  },

  atualizarPublicIds: (
    vistoriaId: string,
    ids: Parameters<typeof _sb.vistorias.atualizarPublicIds>[1],
  ): Promise<void> =>
    http.put(`/vistorias/${vistoriaId}`, deepToCamel(ids) as Record<string, unknown>),

  marcarPendencias: (
    vistoriaId: string,
    pendencias: Parameters<typeof _sb.vistorias.marcarPendencias>[1],
  ): Promise<void> =>
    http.put(`/vistorias/${vistoriaId}`, deepToCamel(pendencias) as Record<string, unknown>),

  registrarSemAcesso: (
    vistoriaId: string,
    payload: Parameters<typeof _sb.vistorias.registrarSemAcesso>[1],
  ): Promise<void> =>
    http.put(`/vistorias/${vistoriaId}`, deepToCamel(payload) as Record<string, unknown>),

  addDeposito: async () => { throw new Error('[sem endpoint NestJS] vistorias.addDeposito'); },
  addSintomas: async () => { throw new Error('[sem endpoint NestJS] vistorias.addSintomas'); },
  addRiscos: async () => { throw new Error('[sem endpoint NestJS] vistorias.addRiscos'); },

  getResumoAgente: (
    clienteId: string,
    agenteId: string,
    ciclo?: number,
  ): Promise<Ret<typeof _sb.vistorias.getResumoAgente>> =>
    http.get(`/dashboard/resumo-agente${qs({ clienteId, agenteId, ciclo })}`),

  comparativoAgentes: (
    clienteId: string,
    ciclo?: number,
  ): Promise<Ret<typeof _sb.vistorias.comparativoAgentes>> =>
    http.get(`/dashboard/comparativo-agentes${qs({ clienteId, ciclo })}`),

  listConsolidadas: (
    clienteId: string,
    filters?: {
      prioridade_final?: string[];
      alerta_saude?: string;
      risco_vetorial?: string;
      consolidacao_incompleta?: boolean;
      limit?: number;
    },
  ): Promise<Record<string, unknown>[]> =>
    http.get(`/vistorias/consolidadas${qs({ clienteId, ...filters })}`),
};
