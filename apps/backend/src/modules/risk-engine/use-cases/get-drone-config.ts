import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';

import { RiskEngineException } from '../errors/risk-engine.exception';
import { RiskEngineReadRepository } from '../repositories/risk-engine-read.repository';

@Injectable()
export class GetDroneConfig {
  constructor(
    private repository: RiskEngineReadRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(clienteId?: string) {
    const tenantId = this.req['tenantId'] as string | undefined;
    const id = clienteId ?? tenantId!;

    const config = await this.repository.getDroneConfig(id);
    if (!config) throw RiskEngineException.droneConfigNotFound();

    return { config };
  }
}
