import { Injectable } from '@nestjs/common';

import { SaveYoloClassInput } from '../dtos/save-risk-policy.body';
import { RiskEngineException } from '../errors/risk-engine.exception';
import { RiskEngineReadRepository } from '../repositories/risk-engine-read.repository';
import { RiskEngineWriteRepository } from '../repositories/risk-engine-write.repository';

@Injectable()
export class SaveYoloClass {
  constructor(
    private readRepository: RiskEngineReadRepository,
    private writeRepository: RiskEngineWriteRepository,
  ) {}

  async execute(input: SaveYoloClassInput) {
    const existing = await this.readRepository.findYoloClassById(input.id);
    if (!existing) throw RiskEngineException.yoloClassNotFound();

    if (input.item !== undefined) existing.item = input.item;
    if (input.risco !== undefined) existing.risco = input.risco;
    if (input.peso !== undefined) existing.peso = input.peso;
    if (input.acao !== undefined) existing.acao = input.acao ?? undefined;
    if (input.isActive !== undefined) existing.isActive = input.isActive;
    existing.updatedAt = new Date();

    await this.writeRepository.saveYoloClass(existing);
    return { yoloClass: existing };
  }
}
