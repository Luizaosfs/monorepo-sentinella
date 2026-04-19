import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { type Ret } from '../shared/case-mappers';

export const reinspecoes = {
  getById: (reinspecaoId: string): Promise<Ret<typeof _sb.reinspecoes.getById>> =>
    http.get(`/reinspecoes/${reinspecaoId}`),

  listByFoco: (focoRiscoId: string): Promise<Ret<typeof _sb.reinspecoes.listByFoco>> =>
    http.get(`/reinspecoes${qs({ focoRiscoId })}`),

  listPendentesAgente: (
    clienteId: string,
    agenteId: string,
  ): Promise<Ret<typeof _sb.reinspecoes.listPendentesAgente>> =>
    http.get(`/reinspecoes${qs({ clienteId, agenteId, status: ['pendente', 'vencida'] })}`),

  listVencidasCliente: (clienteId: string): Promise<Ret<typeof _sb.reinspecoes.listVencidasCliente>> =>
    http.get(`/reinspecoes${qs({ clienteId, status: 'vencida' })}`),

  countPendentesAgente: (clienteId: string, agenteId: string): Promise<number> =>
    http.get(`/reinspecoes/count${qs({ clienteId, agenteId })}`),

  criar: (
    payload: Parameters<typeof _sb.reinspecoes.criar>[0],
  ): Promise<Ret<typeof _sb.reinspecoes.criar>> =>
    http.post('/reinspecoes', payload),

  registrarResultado: (
    payload: Parameters<typeof _sb.reinspecoes.registrarResultado>[0],
  ): Promise<Ret<typeof _sb.reinspecoes.registrarResultado>> =>
    http.patch(`/reinspecoes/${payload.reinspecaoId}/resultado`, payload),

  cancelar: (reinspecaoId: string, motivo?: string): Promise<void> =>
    http.patch(`/reinspecoes/${reinspecaoId}/cancelar`, { motivo }),

  reagendar: (
    reinspecaoId: string,
    novaData: Date,
    responsavelId?: string,
  ): Promise<void> =>
    http.patch(`/reinspecoes/${reinspecaoId}/reagendar`, {
      novaData: novaData.toISOString(),
      responsavelId,
    }),

  marcarVencidas: (): Promise<void> =>
    http.post('/reinspecoes/marcar-vencidas', {}),
};
