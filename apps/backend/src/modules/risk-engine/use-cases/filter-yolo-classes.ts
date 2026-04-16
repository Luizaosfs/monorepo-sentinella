import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';

import { RiskEngineReadRepository } from '../repositories/risk-engine-read.repository';

@Injectable()
export class FilterYoloClasses {
  constructor(
    private repository: RiskEngineReadRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(clienteId?: string) {
    const tenantId = this.req['tenantId'] as string | undefined;
    const id = clienteId ?? tenantId!;

    const classes = await this.repository.filterYoloClasses(id);
    return { classes };
  }
}
