import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { type Ret } from '../shared/case-mappers';

export const analiseIa = {
  /** @fallback tabela levantamento_analise_ia — sem endpoint NestJS para leitura. */
  getByLevantamento: _sb.analiseIa.getByLevantamento.bind(_sb.analiseIa),

  /** POST /ia/triagem-pos-voo — dispara triagem automática pós-voo. */
  triggerTriagem: async (levantamentoId: string): Promise<Ret<typeof _sb.analiseIa.triggerTriagem>> => {
    try { return await http.post('/ia/triagem-pos-voo', { levantamentoId }); }
    catch { return _sb.analiseIa.triggerTriagem(levantamentoId); }
  },
};

export const iaInsights = {
  /** @fallback tabela ia_insights — sem endpoint NestJS para leitura. */
  getResumo: _sb.iaInsights.getResumo.bind(_sb.iaInsights),

  /** POST /ia/insights-regional — gera insights (clienteId via TenantGuard). */
  gerar: async (...args: Parameters<typeof _sb.iaInsights.gerar>): Promise<Ret<typeof _sb.iaInsights.gerar>> => {
    try { return await http.post('/ia/insights-regional', {}); }
    catch { return _sb.iaInsights.gerar(...args); }
  },
};

export const identifyLarva = {
  /** POST /ia/identify-larva — identifica larva em imagem base64. */
  invoke: async (payload: Parameters<typeof _sb.identifyLarva.invoke>[0]): Promise<Ret<typeof _sb.identifyLarva.invoke>> => {
    try { return await http.post('/ia/identify-larva', payload as Record<string, unknown>); }
    catch { return _sb.identifyLarva.invoke(payload); }
  },
};
