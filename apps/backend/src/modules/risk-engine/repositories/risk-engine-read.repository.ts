import { Injectable } from '@nestjs/common';

import { FilterRiskPolicyInputType } from '../dtos/filter-risk-policy.input';
import {
  DroneRiskConfig,
  RiskPolicy,
  RiskPolicyFull,
  YoloClassConfig,
  YoloSynonym,
} from '../entities/risk-engine';

// ── Score types ────────────────────────────────────────────��──────────────────

export interface ScoreImovel {
  clienteId: string;
  imovelId: string;
  score: number;
  classificacao: string;
  fatores: Record<string, unknown>;
  calculadoEm: Date;
  updatedAt: Date;
}

export interface ScoreConfig {
  clienteId: string;
  pesoFocoSuspeito: number;
  pesoFocoConfirmado: number;
  pesoFocoEmTratamento: number;
  pesoFocoRecorrente: number;
  pesoHistorico3focos: number;
  pesoCaso300m: number;
  pesoChuvaAlta: number;
  pesoTemperatura30: number;
  pesoDenunciaCidadao: number;
  pesoImovelRecusa: number;
  pesoSlaVencido: number;
  pesoFocoResolvido: number;
  pesoVistoriaNegativa: number;
  janelaResolucaoDias: number;
  janelaVistoriaDias: number;
  janelaCasoDias: number;
  capFocos: number;
  capEpidemio: number;
  capHistorico: number;
  updatedAt: Date;
}

// ── Abstract repository ───────────────────────────────────────────────────────

@Injectable()
export abstract class RiskEngineReadRepository {
  abstract findPolicyById(id: string): Promise<RiskPolicy | null>;
  abstract findPolicies(filters: FilterRiskPolicyInputType): Promise<RiskPolicy[]>;
  abstract getPolicyFull(policyId: string): Promise<RiskPolicyFull | null>;
  abstract getDroneConfig(clienteId: string): Promise<DroneRiskConfig | null>;
  abstract findYoloClassById(id: string): Promise<YoloClassConfig | null>;
  abstract filterYoloClasses(clienteId: string): Promise<YoloClassConfig[]>;
  abstract filterYoloSynonyms(clienteId: string): Promise<YoloSynonym[]>;

  // Score
  abstract findScoreByImovel(imovelId: string, clienteId: string): Promise<ScoreImovel | null>;
  abstract findTopCriticos(clienteId: string, limit?: number): Promise<ScoreImovel[]>;
  abstract findScoreConfig(clienteId: string): Promise<ScoreConfig | null>;
}
