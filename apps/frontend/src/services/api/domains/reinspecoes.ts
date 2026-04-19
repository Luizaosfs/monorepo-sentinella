import { http } from '@sentinella/api-client';
import { logFallback } from '@/lib/fallbackLogger';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { type Ret } from '../shared/case-mappers';

export const reinspecoes = {
  /** Busca reinspeção por ID com dados do foco e imóvel. */
  getById: (reinspecaoId: string): Promise<Ret<typeof _sb.reinspecoes.getById>> =>
    http.get(`/reinspecoes/${reinspecaoId}`),

  /** Lista reinspeções de um foco, ordem data_prevista DESC. */
  listByFoco: (focoRiscoId: string): Promise<Ret<typeof _sb.reinspecoes.listByFoco>> =>
    http.get(`/reinspecoes${qs({ focoRiscoId })}`),

  /** Lista reinspeções pendentes/vencidas do agente (ou sem responsável). */
  listPendentesAgente: (
    clienteId: string,
    agenteId: string,
  ): Promise<Ret<typeof _sb.reinspecoes.listPendentesAgente>> =>
    http.get(`/reinspecoes${qs({ clienteId, agenteId, status: ['pendente', 'vencida'] })}`),

  /** Lista reinspeções vencidas do cliente (supervisor). */
  listVencidasCliente: (clienteId: string): Promise<Ret<typeof _sb.reinspecoes.listVencidasCliente>> =>
    http.get(`/reinspecoes${qs({ clienteId, status: 'vencida' })}`),

  /** Conta reinspeções pendentes/vencidas de um agente. */
  countPendentesAgente: async (clienteId: string, agenteId: string): Promise<number> => {
    try {
      return await http.get(`/reinspecoes/count${qs({ clienteId, agenteId })}`);
    } catch (err) {
      logFallback('reinspecoes', 'countPendentesAgente', err, '/reinspecoes/count');
      return _sb.reinspecoes.countPendentesAgente(clienteId, agenteId);
    }
  },

  /** Cria reinspeção manual. */
  criar: (
    payload: Parameters<typeof _sb.reinspecoes.criar>[0],
  ): Promise<Ret<typeof _sb.reinspecoes.criar>> =>
    http.post('/reinspecoes', payload),

  /** Registra resultado de uma reinspeção (executada pelo agente). */
  registrarResultado: (
    payload: Parameters<typeof _sb.reinspecoes.registrarResultado>[0],
  ): Promise<Ret<typeof _sb.reinspecoes.registrarResultado>> =>
    http.patch(`/reinspecoes/${payload.reinspecaoId}/resultado`, payload),

  /** Cancela uma reinspeção. */
  cancelar: (reinspecaoId: string, motivo?: string): Promise<void> =>
    http.patch(`/reinspecoes/${reinspecaoId}/cancelar`, { motivo }),

  /** Reagenda para nova data. */
  reagendar: (
    reinspecaoId: string,
    novaData: Date,
    responsavelId?: string,
  ): Promise<void> =>
    http.patch(`/reinspecoes/${reinspecaoId}/reagendar`, {
      novaData: novaData.toISOString(),
      responsavelId,
    }),

  /** Marca reinspeções vencidas (admin job). */
  marcarVencidas: async (): Promise<void> => {
    try { await http.post('/reinspecoes/marcar-vencidas', {}); }
    catch { return _sb.reinspecoes.marcarVencidas(); }
  },
};
