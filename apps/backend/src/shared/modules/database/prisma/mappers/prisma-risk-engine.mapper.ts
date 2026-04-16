import {
  DroneRisco,
  DroneRiskConfig,
  DronePrioridade,
  RiskAdjustPp,
  RiskBin,
  RiskDefaults,
  RiskFactor,
  RiskFallbackRule,
  RiskPolicy,
  RiskRule,
  RiskTendenciaAdjustPp,
  TendenciaTipo,
  YoloClassConfig,
  YoloSynonym,
} from 'src/modules/risk-engine/entities/risk-engine';

// ── Raw DB types (snake_case) ─────────────────────────────────────────────────

type RawPolicy = {
  id: string; cliente_id: string; name: string; version: string;
  is_active: boolean; created_at: Date; updated_at: Date;
};

type RawDefaults = {
  id: string; policy_id: string; chuva_relevante_mm: number;
  dias_lookup_max: number; tendencia_dias: number; created_at: Date;
};

type RawFallback = {
  id: string; policy_id: string; situacao_ambiental: string;
  probabilidade_label: string; probabilidade_pct_min: number;
  probabilidade_pct_max: number; classificacao: string; icone: string;
  severity: number; created_at: Date;
};

type RawRule = {
  id: string; policy_id: string; idx: number;
  chuva_mm_min: number; chuva_mm_max: number;
  dias_min: number; dias_max: number;
  situacao_ambiental: string; probabilidade_label: string;
  probabilidade_pct_min: number; probabilidade_pct_max: number;
  classificacao: string; icone: string; severity: number; created_at: Date;
};

type RawBin = {
  id: string; policy_id: string; idx: number;
  min_val: number; max_val: number;
};

type RawTempFactor = {
  id: string; policy_id: string; idx: number;
  temp_min: number; temp_max: number; factor: number;
};

type RawVentoFactor = {
  id: string; policy_id: string; idx: number;
  vento_min: number; vento_max: number; factor: number;
};

type RawTempAdjust = {
  id: string; policy_id: string; idx: number;
  temp_min: number; temp_max: number; delta_pp: number;
};

type RawVentoAdjust = {
  id: string; policy_id: string; idx: number;
  vento_min: number; vento_max: number; delta_pp: number;
};

type RawPersistenciaAdjust = {
  id: string; policy_id: string; idx: number;
  dias_min: number; dias_max: number; delta_pp: number;
};

type RawTendenciaAdjust = {
  id: string; policy_id: string; tendencia: string; delta_pp: number;
};

type RawDroneConfig = {
  id: string; cliente_id: string;
  base_by_risco: unknown; priority_thresholds: unknown;
  sla_by_priority_hours: unknown; confidence_multiplier: number;
  item_overrides: unknown; created_at: Date; updated_at: Date;
};

type RawYoloClass = {
  id: string; cliente_id: string; item_key: string; item: string;
  risco: string; peso: number; acao: string | null;
  is_active: boolean; created_at: Date; updated_at: Date;
};

type RawYoloSynonym = {
  id: string; cliente_id: string; synonym: string;
  maps_to: string; created_at: Date;
};

// ── Policy mapper ─────────────────────────────────────────────────────────────

export class PrismaRiskPolicyMapper {
  static toDomain(raw: RawPolicy): RiskPolicy {
    return new RiskPolicy(
      { clienteId: raw.cliente_id, name: raw.name, version: raw.version, isActive: raw.is_active },
      { id: raw.id, createdAt: raw.created_at, updatedAt: raw.updated_at },
    );
  }

  static toPrisma(entity: RiskPolicy) {
    return {
      cliente_id: entity.clienteId,
      name: entity.name,
      version: entity.version,
      is_active: entity.isActive,
      updated_at: new Date(),
    };
  }
}

// ── Child table mappers (plain → value objects) ───────────────────────────────

export class PrismaRiskChildMapper {
  static defaultsToDomain(raw: RawDefaults): RiskDefaults {
    return {
      id: raw.id, policyId: raw.policy_id,
      chuvaRelevantemm: raw.chuva_relevante_mm,
      diasLookupMax: raw.dias_lookup_max,
      tendenciaDias: raw.tendencia_dias,
      createdAt: raw.created_at,
    };
  }

  static fallbackToDomain(raw: RawFallback): RiskFallbackRule {
    return {
      id: raw.id, policyId: raw.policy_id,
      situacaoAmbiental: raw.situacao_ambiental,
      probabilidadeLabel: raw.probabilidade_label,
      probabilidadePctMin: raw.probabilidade_pct_min,
      probabilidadePctMax: raw.probabilidade_pct_max,
      classificacao: raw.classificacao,
      icone: raw.icone, severity: raw.severity,
      createdAt: raw.created_at,
    };
  }

  static ruleToDomain(raw: RawRule): RiskRule {
    return {
      id: raw.id, policyId: raw.policy_id, idx: raw.idx,
      chuvaMMMin: raw.chuva_mm_min, chuvaMMMax: raw.chuva_mm_max,
      diasMin: raw.dias_min, diasMax: raw.dias_max,
      situacaoAmbiental: raw.situacao_ambiental,
      probabilidadeLabel: raw.probabilidade_label,
      probabilidadePctMin: raw.probabilidade_pct_min,
      probabilidadePctMax: raw.probabilidade_pct_max,
      classificacao: raw.classificacao, icone: raw.icone, severity: raw.severity,
      createdAt: raw.created_at,
    };
  }

  static binToDomain(raw: RawBin): RiskBin {
    return { id: raw.id, policyId: raw.policy_id, idx: raw.idx, minVal: raw.min_val, maxVal: raw.max_val };
  }

  static tempFactorToDomain(raw: RawTempFactor): RiskFactor {
    return { id: raw.id, policyId: raw.policy_id, idx: raw.idx, minVal: raw.temp_min, maxVal: raw.temp_max, factor: raw.factor };
  }

  static ventoFactorToDomain(raw: RawVentoFactor): RiskFactor {
    return { id: raw.id, policyId: raw.policy_id, idx: raw.idx, minVal: raw.vento_min, maxVal: raw.vento_max, factor: raw.factor };
  }

  static tempAdjustToDomain(raw: RawTempAdjust): RiskAdjustPp {
    return { id: raw.id, policyId: raw.policy_id, idx: raw.idx, minVal: raw.temp_min, maxVal: raw.temp_max, deltaPp: raw.delta_pp };
  }

  static ventoAdjustToDomain(raw: RawVentoAdjust): RiskAdjustPp {
    return { id: raw.id, policyId: raw.policy_id, idx: raw.idx, minVal: raw.vento_min, maxVal: raw.vento_max, deltaPp: raw.delta_pp };
  }

  static persistenciaAdjustToDomain(raw: RawPersistenciaAdjust): RiskAdjustPp {
    return { id: raw.id, policyId: raw.policy_id, idx: raw.idx, minVal: raw.dias_min, maxVal: raw.dias_max, deltaPp: raw.delta_pp };
  }

  static tendenciaAdjustToDomain(raw: RawTendenciaAdjust): RiskTendenciaAdjustPp {
    return { id: raw.id, policyId: raw.policy_id, tendencia: raw.tendencia as TendenciaTipo, deltaPp: raw.delta_pp };
  }
}

// ── DroneRiskConfig mapper ────────────────────────────────────────────────────

export class PrismaDroneRiskConfigMapper {
  static toDomain(raw: RawDroneConfig): DroneRiskConfig {
    return new DroneRiskConfig(
      {
        clienteId: raw.cliente_id,
        baseByRisco: raw.base_by_risco as Record<DroneRisco, number>,
        priorityThresholds: raw.priority_thresholds as Record<DronePrioridade, number>,
        slaByPriorityHours: raw.sla_by_priority_hours as Record<DronePrioridade, number>,
        confidenceMultiplier: raw.confidence_multiplier,
        itemOverrides: raw.item_overrides as Record<string, { min_score?: number; force_priority?: DronePrioridade }>,
      },
      { id: raw.id, createdAt: raw.created_at, updatedAt: raw.updated_at },
    );
  }
}

// ── YoloClassConfig mapper ────────────────────────────────────────────────────

export class PrismaYoloClassConfigMapper {
  static toDomain(raw: RawYoloClass): YoloClassConfig {
    return new YoloClassConfig(
      {
        clienteId: raw.cliente_id, itemKey: raw.item_key, item: raw.item,
        risco: raw.risco as DroneRisco, peso: raw.peso,
        acao: raw.acao ?? undefined, isActive: raw.is_active,
      },
      { id: raw.id, createdAt: raw.created_at, updatedAt: raw.updated_at },
    );
  }

  static toPrisma(entity: YoloClassConfig) {
    return {
      item: entity.item, risco: entity.risco, peso: entity.peso,
      acao: entity.acao ?? null, is_active: entity.isActive,
      updated_at: new Date(),
    };
  }
}

// ── YoloSynonym mapper ────────────────────────────────────────────────────────

export class PrismaYoloSynonymMapper {
  static toDomain(raw: RawYoloSynonym): YoloSynonym {
    return new YoloSynonym(
      { clienteId: raw.cliente_id, synonym: raw.synonym, mapsTo: raw.maps_to },
      { id: raw.id, createdAt: raw.created_at },
    );
  }
}
