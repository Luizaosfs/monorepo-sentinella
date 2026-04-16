import { baseAuditToHttp } from '@shared/view-model/base-audit';

import {
  DroneRiskConfig,
  RiskPolicy,
  RiskPolicyFull,
  YoloClassConfig,
  YoloSynonym,
} from '../entities/risk-engine';

export class RiskPolicyViewModel {
  static toHttp(policy: RiskPolicy) {
    return {
      id: policy.id,
      clienteId: policy.clienteId,
      name: policy.name,
      version: policy.version,
      isActive: policy.isActive,
      createdAt: policy.createdAt,
      updatedAt: policy.updatedAt,
      ...baseAuditToHttp(policy),
    };
  }
}

export class RiskPolicyFullViewModel {
  static toHttp(full: RiskPolicyFull) {
    return {
      policy: RiskPolicyViewModel.toHttp(full.policy),
      defaults: full.defaults,
      fallbackRule: full.fallbackRule,
      rules: full.rules,
      binsSemChuva: full.binsSemChuva,
      binsIntensidadeChuva: full.binsIntensidadeChuva,
      binsPersistencia7d: full.binsPersistencia7d,
      tempFactors: full.tempFactors,
      ventoFactors: full.ventoFactors,
      tempAdjustPp: full.tempAdjustPp,
      ventoAdjustPp: full.ventoAdjustPp,
      persistenciaAdjustPp: full.persistenciaAdjustPp,
      tendenciaAdjustPp: full.tendenciaAdjustPp,
    };
  }
}

export class DroneRiskConfigViewModel {
  static toHttp(config: DroneRiskConfig) {
    return {
      id: config.id,
      clienteId: config.clienteId,
      baseByRisco: config.baseByRisco,
      priorityThresholds: config.priorityThresholds,
      slaByPriorityHours: config.slaByPriorityHours,
      confidenceMultiplier: config.confidenceMultiplier,
      itemOverrides: config.itemOverrides,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
      ...baseAuditToHttp(config),
    };
  }
}

export class YoloClassConfigViewModel {
  static toHttp(cfg: YoloClassConfig) {
    return {
      id: cfg.id,
      clienteId: cfg.clienteId,
      itemKey: cfg.itemKey,
      item: cfg.item,
      risco: cfg.risco,
      peso: cfg.peso,
      acao: cfg.acao,
      isActive: cfg.isActive,
      createdAt: cfg.createdAt,
      updatedAt: cfg.updatedAt,
      ...baseAuditToHttp(cfg),
    };
  }
}

export class YoloSynonymViewModel {
  static toHttp(syn: YoloSynonym) {
    return {
      id: syn.id,
      clienteId: syn.clienteId,
      synonym: syn.synonym,
      mapsTo: syn.mapsTo,
      createdAt: syn.createdAt,
      ...baseAuditToHttp(syn),
    };
  }
}
