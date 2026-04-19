import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToCamel, type Ret } from '../shared/case-mappers';

export const vistorias = {
  /** Lista vistorias de um agente, opcionalmente filtradas por ciclo. */
  listByAgente: async (
    clienteId: string,
    agenteId: string,
    ciclo?: number,
  ): Promise<Ret<typeof _sb.vistorias.listByAgente>> => {
    try {
      return await http.get(`/vistorias${qs({ clienteId, agenteId, ciclo })}`);
    } catch {
      return _sb.vistorias.listByAgente(clienteId, agenteId, ciclo);
    }
  },

  /** Lista vistorias de um imóvel. */
  listByImovel: async (
    imovelId: string,
    clienteId: string,
  ): Promise<Ret<typeof _sb.vistorias.listByImovel>> => {
    try {
      return await http.get(`/vistorias${qs({ imovelId, clienteId })}`);
    } catch {
      return _sb.vistorias.listByImovel(imovelId, clienteId);
    }
  },

  /** Cria vistoria básica. Payload snake_case convertido para camelCase. */
  create: async (
    payload: Parameters<typeof _sb.vistorias.create>[0],
  ): Promise<Ret<typeof _sb.vistorias.create>> => {
    try {
      return await http.post('/vistorias', deepToCamel(payload) as Record<string, unknown>);
    } catch {
      return _sb.vistorias.create(payload);
    }
  },

  /** Atualiza status de uma vistoria. */
  updateStatus: async (
    id: string,
    status: Parameters<typeof _sb.vistorias.updateStatus>[1],
  ): Promise<void> => {
    try {
      return await http.put(`/vistorias/${id}`, { status });
    } catch {
      return _sb.vistorias.updateStatus(id, status);
    }
  },

  /**
   * Cria vistoria completa (com depósitos, sintomas, riscos, calhas) em uma transação.
   * Payload snake_case convertido para camelCase. Retorna o UUID da vistoria criada.
   */
  createCompleta: async (payload: Record<string, unknown>): Promise<string> => {
    try {
      const result = await http.post<{ id: string }>(
        '/vistorias/completa',
        deepToCamel(payload) as Record<string, unknown>,
      );
      return result.id;
    } catch {
      return _sb.vistorias.createCompleta(payload);
    }
  },

  /** Persiste public_ids do Cloudinary após createCompleta. */
  atualizarPublicIds: async (
    vistoriaId: string,
    ids: Parameters<typeof _sb.vistorias.atualizarPublicIds>[1],
  ): Promise<void> => {
    try {
      return await http.put(`/vistorias/${vistoriaId}`, deepToCamel(ids) as Record<string, unknown>);
    } catch {
      return _sb.vistorias.atualizarPublicIds(vistoriaId, ids);
    }
  },

  /** Marca pendências de evidências perdidas no modo offline. */
  marcarPendencias: async (
    vistoriaId: string,
    pendencias: Parameters<typeof _sb.vistorias.marcarPendencias>[1],
  ): Promise<void> => {
    try {
      return await http.put(`/vistorias/${vistoriaId}`, deepToCamel(pendencias) as Record<string, unknown>);
    } catch {
      return _sb.vistorias.marcarPendencias(vistoriaId, pendencias);
    }
  },

  /** Registra vistoria sem acesso ao imóvel. */
  registrarSemAcesso: async (
    vistoriaId: string,
    payload: Parameters<typeof _sb.vistorias.registrarSemAcesso>[1],
  ): Promise<void> => {
    try {
      return await http.put(`/vistorias/${vistoriaId}`, deepToCamel(payload) as Record<string, unknown>);
    } catch {
      return _sb.vistorias.registrarSemAcesso(vistoriaId, payload);
    }
  },

  // ── Fallback Supabase — sem endpoint NestJS equivalente ────────────────
  /** @fallback Depósito individual: sem endpoint NestJS; coberto por createCompleta. */
  addDeposito: _sb.vistorias.addDeposito.bind(_sb.vistorias),
  /** @fallback Sintomas individuais: sem endpoint NestJS. */
  addSintomas: _sb.vistorias.addSintomas.bind(_sb.vistorias),
  /** @fallback Riscos individuais: sem endpoint NestJS. */
  addRiscos: _sb.vistorias.addRiscos.bind(_sb.vistorias),
  /** GET /dashboard/resumo-agente?clienteId&agenteId&ciclo */
  getResumoAgente: async (
    clienteId: string,
    agenteId: string,
    ciclo?: number,
  ): Promise<Ret<typeof _sb.vistorias.getResumoAgente>> => {
    try { return await http.get(`/dashboard/resumo-agente${qs({ clienteId, agenteId, ciclo })}`); }
    catch { return _sb.vistorias.getResumoAgente(clienteId, agenteId, ciclo); }
  },

  /** GET /dashboard/comparativo-agentes?clienteId&ciclo */
  comparativoAgentes: async (
    clienteId: string,
    ciclo?: number,
  ): Promise<Ret<typeof _sb.vistorias.comparativoAgentes>> => {
    try { return await http.get(`/dashboard/comparativo-agentes${qs({ clienteId, ciclo })}`); }
    catch { return _sb.vistorias.comparativoAgentes(clienteId, ciclo); }
  },
  /** @fallback Filtros específicos (alertaSaude, riscoVetorial) fora do schema do backend. */
  listConsolidadas: _sb.vistorias.listConsolidadas.bind(_sb.vistorias),
};
