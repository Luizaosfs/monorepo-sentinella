import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { getAccessScope } from '@shared/security/access-scope.helpers';

import { FilterRiskPolicyInputType } from '../dtos/filter-risk-policy.input';
import { RiskEngineReadRepository } from '../repositories/risk-engine-read.repository';

@Injectable()
export class GetPolicy {
  constructor(
    private repository: RiskEngineReadRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(filters: FilterRiskPolicyInputType) {
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = getAccessScope(this.req).tenantId ?? undefined;

    const policies = await this.repository.findPolicies({ ...filters, clienteId });
    return { policies };
  }
}
