import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';

import { FilterRiskPolicyInputType } from '../dtos/filter-risk-policy.input';
import { RiskEngineReadRepository } from '../repositories/risk-engine-read.repository';

@Injectable()
export class GetPolicy {
  constructor(
    private repository: RiskEngineReadRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(filters: FilterRiskPolicyInputType) {
    const tenantId = this.req['tenantId'] as string | undefined;
    const clienteId = filters.clienteId ?? tenantId;

    const policies = await this.repository.findPolicies({ ...filters, clienteId });
    return { policies };
  }
}
