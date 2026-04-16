import { Injectable } from '@nestjs/common';

import { FilterRiskPolicyInputType } from '../dtos/filter-risk-policy.input';
import {
  DroneRiskConfig,
  RiskPolicy,
  RiskPolicyFull,
  YoloClassConfig,
  YoloSynonym,
} from '../entities/risk-engine';

@Injectable()
export abstract class RiskEngineReadRepository {
  abstract findPolicyById(id: string): Promise<RiskPolicy | null>;
  abstract findPolicies(filters: FilterRiskPolicyInputType): Promise<RiskPolicy[]>;
  abstract getPolicyFull(policyId: string): Promise<RiskPolicyFull | null>;
  abstract getDroneConfig(clienteId: string): Promise<DroneRiskConfig | null>;
  abstract findYoloClassById(id: string): Promise<YoloClassConfig | null>;
  abstract filterYoloClasses(clienteId: string): Promise<YoloClassConfig[]>;
  abstract filterYoloSynonyms(clienteId: string): Promise<YoloSynonym[]>;
}
