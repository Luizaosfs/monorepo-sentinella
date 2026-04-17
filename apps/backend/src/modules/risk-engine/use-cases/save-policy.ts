import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';

import { SaveRiskPolicyInput } from '../dtos/save-risk-policy.body';
import { RiskPolicy } from '../entities/risk-engine';
import { RiskEngineException } from '../errors/risk-engine.exception';
import { RiskEngineReadRepository } from '../repositories/risk-engine-read.repository';
import { RiskEngineWriteRepository } from '../repositories/risk-engine-write.repository';

@Injectable()
export class SavePolicy {
  constructor(
    private readRepository: RiskEngineReadRepository,
    private writeRepository: RiskEngineWriteRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(input: SaveRiskPolicyInput & { id?: string }) {
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = this.req['tenantId'] as string;

    if (input.id) {
      // Update
      const existing = await this.readRepository.findPolicyById(input.id);
      if (!existing) throw RiskEngineException.notFound();

      existing.name = input.name;
      existing.version = input.version;
      existing.isActive = input.isActive;
      existing.updatedAt = new Date();

      await this.writeRepository.savePolicy(existing);
      return { policy: existing };
    }

    // Create
    const policy = new RiskPolicy(
      {
        clienteId,
        name: input.name,
        version: input.version,
        isActive: input.isActive,
      },
      { createdBy: this.req['user']?.id },
    );

    const created = await this.writeRepository.createPolicy(policy);
    return { policy: created };
  }
}
