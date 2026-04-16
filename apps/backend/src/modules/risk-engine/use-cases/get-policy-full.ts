import { Injectable } from '@nestjs/common';

import { RiskEngineException } from '../errors/risk-engine.exception';
import { RiskEngineReadRepository } from '../repositories/risk-engine-read.repository';

@Injectable()
export class GetPolicyFull {
  constructor(private repository: RiskEngineReadRepository) {}

  async execute(policyId: string) {
    const full = await this.repository.getPolicyFull(policyId);
    if (!full) throw RiskEngineException.notFound();
    return { full };
  }
}
