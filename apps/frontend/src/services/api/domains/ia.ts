import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { type Ret } from '../shared/case-mappers';

export const analiseIa = {
  getByLevantamento: (levantamentoId: string): Promise<Ret<typeof _sb.analiseIa.getByLevantamento>> =>
    http.get(`/ia/analise/${levantamentoId}`),

  triggerTriagem: (levantamentoId: string): Promise<Ret<typeof _sb.analiseIa.triggerTriagem>> =>
    http.post('/ia/triagem-pos-voo', { levantamentoId }),
};

export const iaInsights = {
  getResumo: (..._args: Parameters<typeof _sb.iaInsights.getResumo>): Promise<Ret<typeof _sb.iaInsights.getResumo>> =>
    http.get('/ia/insights'),

  gerar: (..._args: Parameters<typeof _sb.iaInsights.gerar>): Promise<Ret<typeof _sb.iaInsights.gerar>> =>
    http.post('/ia/insights-regional', {}),
};

export const identifyLarva = {
  invoke: (payload: Parameters<typeof _sb.identifyLarva.invoke>[0]): Promise<Ret<typeof _sb.identifyLarva.invoke>> =>
    http.post('/ia/identify-larva', payload as Record<string, unknown>),
};
