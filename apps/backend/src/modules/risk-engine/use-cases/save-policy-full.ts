import { Injectable } from '@nestjs/common';

import { SavePolicyFullInput } from '../dtos/save-risk-policy.body';
import {
  RiskAdjustPp,
  RiskBin,
  RiskDefaults,
  RiskFactor,
  RiskFallbackRule,
  RiskRule,
  RiskTendenciaAdjustPp,
  TendenciaTipo,
} from '../entities/risk-engine';
import { RiskEngineException } from '../errors/risk-engine.exception';
import { RiskEngineReadRepository } from '../repositories/risk-engine-read.repository';
import { RiskEngineWriteRepository } from '../repositories/risk-engine-write.repository';

@Injectable()
export class SavePolicyFull {
  constructor(
    private readRepository: RiskEngineReadRepository,
    private writeRepository: RiskEngineWriteRepository,
  ) {}

  async execute(policyId: string, input: SavePolicyFullInput) {
    const existing = await this.readRepository.findPolicyById(policyId);
    if (!existing) throw RiskEngineException.notFound();

    // Optionally update header fields
    if (input.name !== undefined) existing.name = input.name;
    if (input.version !== undefined) existing.version = input.version;
    if (input.isActive !== undefined) existing.isActive = input.isActive;
    existing.updatedAt = new Date();
    await this.writeRepository.savePolicy(existing);

    // Build child value objects
    const defaults: RiskDefaults | null = input.defaults
      ? { policyId, ...input.defaults }
      : null;

    const fallbackRule: RiskFallbackRule | null = input.fallbackRule
      ? { policyId, ...input.fallbackRule }
      : null;

    const rules: RiskRule[] = (input.rules ?? []).map((r, i) => ({
      policyId,
      idx: i,
      chuvaMMMin: r.chuvaMMMin,
      chuvaMMMax: r.chuvaMMMax,
      diasMin: r.diasMin,
      diasMax: r.diasMax,
      situacaoAmbiental: r.situacaoAmbiental,
      probabilidadeLabel: r.probabilidadeLabel,
      probabilidadePctMin: r.probabilidadePctMin,
      probabilidadePctMax: r.probabilidadePctMax,
      classificacao: r.classificacao,
      icone: r.icone,
      severity: r.severity,
    }));

    const toBins = (arr: { idx: number; minVal: number; maxVal: number }[] = []): RiskBin[] =>
      arr.map((b, i) => ({ policyId, idx: i, minVal: b.minVal, maxVal: b.maxVal }));

    const toFactors = (arr: { idx: number; minVal: number; maxVal: number; factor: number }[] = []): RiskFactor[] =>
      arr.map((f, i) => ({ policyId, idx: i, minVal: f.minVal, maxVal: f.maxVal, factor: f.factor }));

    const toAdjusts = (arr: { idx: number; minVal: number; maxVal: number; deltaPp: number }[] = []): RiskAdjustPp[] =>
      arr.map((a, i) => ({ policyId, idx: i, minVal: a.minVal, maxVal: a.maxVal, deltaPp: a.deltaPp }));

    const tendenciaAdjustPp: RiskTendenciaAdjustPp[] = (input.tendenciaAdjustPp ?? []).map((t) => ({
      policyId,
      tendencia: t.tendencia as TendenciaTipo,
      deltaPp: t.deltaPp,
    }));

    await this.writeRepository.savePolicyFull(policyId, {
      defaults,
      fallbackRule,
      rules,
      binsSemChuva: toBins(input.binsSemChuva),
      binsIntensidadeChuva: toBins(input.binsIntensidadeChuva),
      binsPersistencia7d: toBins(input.binsPersistencia7d),
      tempFactors: toFactors(input.tempFactors),
      ventoFactors: toFactors(input.ventoFactors),
      tempAdjustPp: toAdjusts(input.tempAdjustPp),
      ventoAdjustPp: toAdjusts(input.ventoAdjustPp),
      persistenciaAdjustPp: toAdjusts(input.persistenciaAdjustPp),
      tendenciaAdjustPp,
    });

    const full = await this.readRepository.getPolicyFull(policyId);
    return { full: full! };
  }
}
