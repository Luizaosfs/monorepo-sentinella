import { http } from '@sentinella/api-client';
import { api as _sb } from '../../api-stub';
import { qs } from '../shared/qs';
import { deepToCamel, deepToSnake, type Ret } from '../shared/case-mappers';

// ── Policy header ─────────────────────────────────────────────────────────────

export const riskPolicy = {
  /** Lista políticas do cliente. Backend: GET /risk-engine/policy?clienteId */
  listByCliente: async (clienteId: string): Promise<Ret<typeof _sb.riskPolicy.listByCliente>> => {
    try {
      const raw = await http.get(`/risk-engine/policy${qs({ clienteId })}`);
      return deepToSnake(Array.isArray(raw) ? raw : [raw]) as Ret<typeof _sb.riskPolicy.listByCliente>;
    } catch { return _sb.riskPolicy.listByCliente(clienteId); }
  },

  /** Remove política. Backend: DELETE /risk-engine/policy/:id */
  delete: async (id: string): Promise<void> => {
    try { await http.delete(`/risk-engine/policy/${id}`); }
    catch { await _sb.riskPolicy.delete(id); }
  },

  /** @fallback sem endpoint para listar clienteIds distintos. */
  listAllClienteIds: _sb.riskPolicy.listAllClienteIds.bind(_sb.riskPolicy),
};

export const riskPolicyHeader = {
  /**
   * Cria cabeçalho de política. Backend: PUT /risk-engine/policy (sem ?id → insert).
   * Componente chama: create(clienteId, { name, version, is_active }).
   */
  create: async (
    clienteId: string,
    payload: { name: string; version: string; is_active?: boolean },
  ): Promise<Ret<typeof _sb.riskPolicyHeader.create>> => {
    try {
      const raw = await http.put('/risk-engine/policy', deepToCamel({ clienteId, ...payload }));
      return deepToSnake(raw) as Ret<typeof _sb.riskPolicyHeader.create>;
    } catch { return _sb.riskPolicyHeader.create(clienteId, payload); }
  },

  /**
   * Atualiza cabeçalho de política. Backend: PUT /risk-engine/policy?id=X.
   * Componente chama: update(policyId, { name, version, is_active }).
   */
  update: async (
    id: string,
    payload: { name?: string; version?: string; is_active?: boolean },
  ): Promise<Ret<typeof _sb.riskPolicyHeader.update>> => {
    try {
      const raw = await http.put(`/risk-engine/policy${qs({ id })}`, deepToCamel(payload as Record<string, unknown>));
      return deepToSnake(raw) as Ret<typeof _sb.riskPolicyHeader.update>;
    } catch { return _sb.riskPolicyHeader.update(id, payload); }
  },
};

// ── Policy editor (sub-tabelas) — GET/PUT /risk-engine/policy/:id/full ────────
//
// O backend aceita PUT parcial (todos os campos são opcionais em savePolicyFullSchema),
// portanto cada setter envia apenas o sub-objeto alterado, sem read-modify-write.

export const riskPolicyEditor = {
  getDefaults: async (policyId: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const full = await http.get(`/risk-engine/policy/${policyId}/full`) as any;
      return full?.defaults ?? null;
    } catch { return _sb.riskPolicyEditor.getDefaults(policyId); }
  },

  upsertDefaults: async (policyId: string, defaults: unknown, _existingId?: unknown): Promise<void> => {
    try { await http.put(`/risk-engine/policy/${policyId}/full`, { defaults }); }
    catch { return _sb.riskPolicyEditor.upsertDefaults(policyId, defaults, _existingId); }
  },

  /** binType: 'binsSemChuva' | 'binsIntensidadeChuva' | 'binsPersistencia7d' */
  listBins: async (binType: string, policyId: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const full = await http.get(`/risk-engine/policy/${policyId}/full`) as any;
      return full?.[binType] ?? [];
    } catch { return _sb.riskPolicyEditor.listBins(binType, policyId); }
  },

  replaceBins: async (binType: string, policyId: string, bins: unknown[]): Promise<void> => {
    try { await http.put(`/risk-engine/policy/${policyId}/full`, { [binType]: bins }); }
    catch { return _sb.riskPolicyEditor.replaceBins(binType, policyId, bins); }
  },

  /** factorType: 'tempFactors' | 'ventoFactors' — minField/maxField ignorados (Supabase-only). */
  listFactors: async (factorType: string, policyId: string, _minField?: unknown, _maxField?: unknown) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const full = await http.get(`/risk-engine/policy/${policyId}/full`) as any;
      return full?.[factorType] ?? [];
    } catch { return _sb.riskPolicyEditor.listFactors(factorType, policyId, _minField, _maxField); }
  },

  replaceFactors: async (factorType: string, policyId: string, _minField: unknown, _maxField: unknown, factors: unknown[]): Promise<void> => {
    try { await http.put(`/risk-engine/policy/${policyId}/full`, { [factorType]: factors }); }
    catch { return _sb.riskPolicyEditor.replaceFactors(factorType, policyId, _minField, _maxField, factors); }
  },

  /** adjustType: 'tempAdjustPp' | 'ventoAdjustPp' | 'persistenciaAdjustPp' */
  listAdjusts: async (adjustType: string, policyId: string, _minField?: unknown, _maxField?: unknown) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const full = await http.get(`/risk-engine/policy/${policyId}/full`) as any;
      return full?.[adjustType] ?? [];
    } catch { return _sb.riskPolicyEditor.listAdjusts(adjustType, policyId, _minField, _maxField); }
  },

  replaceAdjusts: async (adjustType: string, policyId: string, _minField: unknown, _maxField: unknown, adjusts: unknown[]): Promise<void> => {
    try { await http.put(`/risk-engine/policy/${policyId}/full`, { [adjustType]: adjusts }); }
    catch { return _sb.riskPolicyEditor.replaceAdjusts(adjustType, policyId, _minField, _maxField, adjusts); }
  },

  listTendenciaAdjusts: async (policyId: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const full = await http.get(`/risk-engine/policy/${policyId}/full`) as any;
      return full?.tendenciaAdjustPp ?? [];
    } catch { return _sb.riskPolicyEditor.listTendenciaAdjusts(policyId); }
  },

  replaceTendenciaAdjusts: async (policyId: string, adjusts: unknown[]): Promise<void> => {
    try { await http.put(`/risk-engine/policy/${policyId}/full`, { tendenciaAdjustPp: adjusts }); }
    catch { return _sb.riskPolicyEditor.replaceTendenciaAdjusts(policyId, adjusts); }
  },

  listRules: async (policyId: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const full = await http.get(`/risk-engine/policy/${policyId}/full`) as any;
      return full?.rules ?? [];
    } catch { return _sb.riskPolicyEditor.listRules(policyId); }
  },

  replaceRules: async (policyId: string, rules: unknown[]): Promise<void> => {
    try { await http.put(`/risk-engine/policy/${policyId}/full`, { rules }); }
    catch { return _sb.riskPolicyEditor.replaceRules(policyId, rules); }
  },

  getFallbackRule: async (policyId: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const full = await http.get(`/risk-engine/policy/${policyId}/full`) as any;
      return full?.fallbackRule ?? null;
    } catch { return _sb.riskPolicyEditor.getFallbackRule(policyId); }
  },

  /** _existingId é usado pelo Supabase para upsert; NestJS não precisa. */
  upsertFallbackRule: async (policyId: string, rule: unknown, _existingId?: unknown): Promise<void> => {
    try { await http.put(`/risk-engine/policy/${policyId}/full`, { fallbackRule: rule }); }
    catch { return _sb.riskPolicyEditor.upsertFallbackRule(policyId, rule, _existingId); }
  },

  /** Salva política completa. Backend: PUT /risk-engine/policy/:id/full */
  importAll: async (policyId: string, data: unknown) => {
    try { return await http.put(`/risk-engine/policy/${policyId}/full`, data); }
    catch { return _sb.riskPolicyEditor.importAll(policyId, data); }
  },
};

// ── LIRAa — endpoints do dashboard ───────────────────────────────────────────

export const liraa = {
  /** Calcula LIRAa (IIP e IBP) do ciclo. Backend: GET /dashboard/liraa?clienteId&ciclo */
  calcular: async (clienteId: string, ciclo?: number): Promise<Ret<typeof _sb.liraa.calcular>> => {
    try { return await http.get(`/dashboard/liraa${qs({ clienteId, ciclo })}`); }
    catch { return _sb.liraa.calcular(clienteId, ciclo); }
  },

  /** Consumo de larvicida. Backend: GET /dashboard/consumo-larvicida?clienteId&ciclo */
  consumoLarvicida: async (clienteId: string, ciclo?: number): Promise<Ret<typeof _sb.liraa.consumoLarvicida>> => {
    try { return await http.get(`/dashboard/consumo-larvicida${qs({ clienteId, ciclo })}`); }
    catch { return _sb.liraa.consumoLarvicida(clienteId, ciclo); }
  },

  /** @fallback view v_liraa_quarteirao — sem endpoint NestJS. */
  /** @fallback v_liraa_quarteirao — agregação por quarteirão sem endpoint NestJS */
  listPorQuarteirao: _sb.liraa.listPorQuarteirao.bind(_sb.liraa),

  /** GET /dashboard/ciclos-disponiveis */
  listCiclosDisponiveis: async (clienteId: string): Promise<Ret<typeof _sb.liraa.listCiclosDisponiveis>> => {
    try { return await http.get('/dashboard/ciclos-disponiveis'); }
    catch { return _sb.liraa.listCiclosDisponiveis(clienteId); }
  },

  /** GET /dashboard/liraa/export?ciclo — retorna dados estruturados (sem PDF binário) */
  exportarPdf: async (clienteId: string, ciclo?: number): Promise<Ret<typeof _sb.liraa.exportarPdf>> => {
    try { return await http.get(`/dashboard/liraa/export${qs({ ciclo })}`); }
    catch { return _sb.liraa.exportarPdf(clienteId, ciclo); }
  },
};

// ── Score territorial — sem endpoint NestJS ───────────────────────────────────
// territorio_score e v_score_bairro não estão expostos no risk-engine controller.

export const score = {
  /** GET /risk-engine/score/imovel/:imovelId */
  getImovel: async (imovelId: string): Promise<Ret<typeof _sb.score.getImovel>> => {
    try { return await http.get(`/risk-engine/score/imovel/${imovelId}`); }
    catch { return _sb.score.getImovel(imovelId); }
  },

  /** GET /risk-engine/score?limit= */
  listTopCriticos: async (clienteId: string, limit?: number): Promise<Ret<typeof _sb.score.listTopCriticos>> => {
    try { return await http.get(`/risk-engine/score${qs({ limit })}`); }
    catch { return _sb.score.listTopCriticos(clienteId, limit); }
  },

  /** @fallback v_score_bairro não exposta no backend */
  listBairros: _sb.score.listBairros.bind(_sb.score),

  /** GET /risk-engine/score/config */
  getConfig: async (clienteId: string): Promise<Ret<typeof _sb.score.getConfig>> => {
    try { return await http.get('/risk-engine/score/config'); }
    catch { return _sb.score.getConfig(clienteId); }
  },

  /** POST /risk-engine/score/recalcular */
  forcarRecalculo: async (clienteId: string): Promise<Ret<typeof _sb.score.forcarRecalculo>> => {
    try { return await http.post('/risk-engine/score/recalcular', {}); }
    catch { return _sb.score.forcarRecalculo(clienteId); }
  },

  /** PUT /risk-engine/score/config */
  upsertConfig: async (clienteId: string, config: unknown): Promise<Ret<typeof _sb.score.upsertConfig>> => {
    try { return await http.put('/risk-engine/score/config', config as Record<string, unknown>); }
    catch { return _sb.score.upsertConfig(clienteId, config); }
  },
};
