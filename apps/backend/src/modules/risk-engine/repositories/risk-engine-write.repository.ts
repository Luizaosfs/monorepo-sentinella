import { Injectable } from '@nestjs/common';

import { SaveDroneConfigInput } from '../dtos/save-risk-policy.body';
import {
  DroneRiskConfig,
  RiskPolicy,
  RiskPolicyFull,
  YoloClassConfig,
  YoloSynonym,
} from '../entities/risk-engine';

@Injectable()
export abstract class RiskEngineWriteRepository {
  abstract createPolicy(policy: RiskPolicy): Promise<RiskPolicy>;
  abstract savePolicy(policy: RiskPolicy): Promise<void>;
  abstract deletePolicy(id: string): Promise<void>;
  abstract savePolicyFull(
    policyId: string,
    full: Omit<RiskPolicyFull, 'policy'>,
  ): Promise<void>;
  abstract saveDroneConfig(
    clienteId: string,
    data: SaveDroneConfigInput,
  ): Promise<DroneRiskConfig>;
  abstract saveYoloClass(config: YoloClassConfig): Promise<void>;
  abstract createYoloSynonym(synonym: YoloSynonym): Promise<YoloSynonym>;
  abstract deleteYoloSynonym(id: string): Promise<void>;
}
