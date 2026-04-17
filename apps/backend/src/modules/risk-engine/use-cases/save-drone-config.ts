import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';

import { SaveDroneConfigInput } from '../dtos/save-risk-policy.body';
import { RiskEngineWriteRepository } from '../repositories/risk-engine-write.repository';

@Injectable()
export class SaveDroneConfig {
  constructor(
    private repository: RiskEngineWriteRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(input: SaveDroneConfigInput) {
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const id = this.req['tenantId'] as string;

    const config = await this.repository.saveDroneConfig(id, input);
    return { config };
  }
}
