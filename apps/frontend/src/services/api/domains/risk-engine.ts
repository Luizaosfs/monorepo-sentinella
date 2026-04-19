import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToCamel, deepToSnake, type Ret } from '../shared/case-mappers';

// ── Policy header ─────────────────────────────────────────────────────────────

export const riskPolicy = {
  listByCliente: async (clienteId: string): Promise<Ret<typeof _sb.riskPolicy.listByCliente>> => {
    const raw = await http.get(`/risk-engine/policy${qs({ clienteId })}`);
    return deepToSnake(Array.isArray(raw) ? raw : [raw]) as Ret<typeof _sb.riskPolicy.listByCliente>;
  },

  delete: (id: string): Promise<void> =>
    http.delete(`/risk-engine/policy/${id}`),

  listAllClienteIds: (): Promise<unknown> => http.get('/risk-engine/policy/cliente-ids'),
};

export const riskPolicyHeader = {
  create: async (
    clienteId: string,
    payload: { name: string; version: string; is_active?: boolean },
  ): Promise<Ret<typeof _sb.riskPolicyHeader.create>> => {
    const raw = await http.put('/risk-engine/policy', deepToCamel({ clienteId, ...payload }));
    return deepToSnake(raw) as Ret<typeof _sb.riskPolicyHeader.create>;
  },

  update: async (
    id: string,
    payload: { name?: string; version?: string; is_active?: boolean },
  ): Promise<Ret<typeof _sb.riskPolicyHeader.update>> => {
    const raw = await http.put(`/risk-engine/policy${qs({ id })}`, deepToCamel(payload as Record<string, unknown>));
    return deepToSnake(raw) as Ret<typeof _sb.riskPolicyHeader.update>;
  },
};

// ── Policy editor (sub-tabelas) — GET/PUT /risk-engine/policy/:id/full ────────

export const riskPolicyEditor = {
  getDefaults: async (policyId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const full = await http.get(`/risk-engine/policy/${policyId}/full`) as any;
    return full?.defaults ?? null;
  },

  upsertDefaults: (policyId: string, defaults: unknown, _existingId?: unknown): Promise<void> =>
    http.put(`/risk-engine/policy/${policyId}/full`, { defaults }),

  listBins: async (binType: string, policyId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const full = await http.get(`/risk-engine/policy/${policyId}/full`) as any;
    return full?.[binType] ?? [];
  },

  replaceBins: (binType: string, policyId: string, bins: unknown[]): Promise<void> =>
    http.put(`/risk-engine/policy/${policyId}/full`, { [binType]: bins }),

  listFactors: async (factorType: string, policyId: string, _minField?: unknown, _maxField?: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const full = await http.get(`/risk-engine/policy/${policyId}/full`) as any;
    return full?.[factorType] ?? [];
  },

  replaceFactors: (factorType: string, policyId: string, _minField: unknown, _maxField: unknown, factors: unknown[]): Promise<void> =>
    http.put(`/risk-engine/policy/${policyId}/full`, { [factorType]: factors }),

  listAdjusts: async (adjustType: string, policyId: string, _minField?: unknown, _maxField?: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const full = await http.get(`/risk-engine/policy/${policyId}/full`) as any;
    return full?.[adjustType] ?? [];
  },

  replaceAdjusts: (adjustType: string, policyId: string, _minField: unknown, _maxField: unknown, adjusts: unknown[]): Promise<void> =>
    http.put(`/risk-engine/policy/${policyId}/full`, { [adjustType]: adjusts }),

  listTendenciaAdjusts: async (policyId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const full = await http.get(`/risk-engine/policy/${policyId}/full`) as any;
    return full?.tendenciaAdjustPp ?? [];
  },

  replaceTendenciaAdjusts: (policyId: string, adjusts: unknown[]): Promise<void> =>
    http.put(`/risk-engine/policy/${policyId}/full`, { tendenciaAdjustPp: adjusts }),

  listRules: async (policyId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const full = await http.get(`/risk-engine/policy/${policyId}/full`) as any;
    return full?.rules ?? [];
  },

  replaceRules: (policyId: string, rules: unknown[]): Promise<void> =>
    http.put(`/risk-engine/policy/${policyId}/full`, { rules }),

  getFallbackRule: async (policyId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const full = await http.get(`/risk-engine/policy/${policyId}/full`) as any;
    return full?.fallbackRule ?? null;
  },

  upsertFallbackRule: (policyId: string, rule: unknown, _existingId?: unknown): Promise<void> =>
    http.put(`/risk-engine/policy/${policyId}/full`, { fallbackRule: rule }),

  importAll: (policyId: string, data: unknown) =>
    http.put(`/risk-engine/policy/${policyId}/full`, data),
};

// ── LIRAa — endpoints do dashboard ───────────────────────────────────────────

export const liraa = {
  calcular: (clienteId: string, ciclo?: number): Promise<Ret<typeof _sb.liraa.calcular>> =>
    http.get(`/dashboard/liraa${qs({ clienteId, ciclo })}`),

  consumoLarvicida: (clienteId: string, ciclo?: number): Promise<Ret<typeof _sb.liraa.consumoLarvicida>> =>
    http.get(`/dashboard/consumo-larvicida${qs({ clienteId, ciclo })}`),

  listPorQuarteirao: (clienteId: string, ciclo?: number): Promise<Ret<typeof _sb.liraa.listPorQuarteirao>> =>
    http.get(`/dashboard/liraa/quarteirao${qs({ ciclo })}`),

  listCiclosDisponiveis: (_clienteId: string): Promise<Ret<typeof _sb.liraa.listCiclosDisponiveis>> =>
    http.get('/dashboard/ciclos-disponiveis'),

  exportarPdf: (_clienteId: string, ciclo?: number): Promise<Ret<typeof _sb.liraa.exportarPdf>> =>
    http.get(`/dashboard/liraa/export${qs({ ciclo })}`),
};

// ── Score territorial ─────────────────────────────────────────────────────────

export const score = {
  getImovel: (imovelId: string): Promise<Ret<typeof _sb.score.getImovel>> =>
    http.get(`/risk-engine/score/imovel/${imovelId}`),

  listTopCriticos: (_clienteId: string, limit?: number): Promise<Ret<typeof _sb.score.listTopCriticos>> =>
    http.get(`/risk-engine/score${qs({ limit })}`),

  listBairros: (): Promise<unknown> => http.get('/risk-engine/score/bairros'),

  getConfig: (_clienteId: string): Promise<Ret<typeof _sb.score.getConfig>> =>
    http.get('/risk-engine/score/config'),

  forcarRecalculo: (_clienteId: string): Promise<Ret<typeof _sb.score.forcarRecalculo>> =>
    http.post('/risk-engine/score/recalcular', {}),

  upsertConfig: (_clienteId: string, config: unknown): Promise<Ret<typeof _sb.score.upsertConfig>> =>
    http.put('/risk-engine/score/config', config as Record<string, unknown>),
};
