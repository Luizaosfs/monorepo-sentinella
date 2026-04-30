import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';

import { RiskEngineReadRepository } from '../repositories/risk-engine-read.repository';

@Injectable()
export class FilterYoloClasses {
  constructor(
    private repository: RiskEngineReadRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute() {
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const id = requireTenantId(getAccessScope(this.req));

    const classes = await this.repository.filterYoloClasses(id);
    return { classes };
  }
}
