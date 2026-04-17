import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';

import { SaveYoloSynonymInput } from '../dtos/save-risk-policy.body';
import { YoloSynonym } from '../entities/risk-engine';
import { RiskEngineWriteRepository } from '../repositories/risk-engine-write.repository';

@Injectable()
export class SaveYoloSynonym {
  constructor(
    private repository: RiskEngineWriteRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(input: SaveYoloSynonymInput) {
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = this.req['tenantId'] as string;

    const synonym = new YoloSynonym(
      {
        clienteId,
        synonym: input.synonym.trim().toLowerCase(),
        mapsTo: input.mapsTo.trim().toLowerCase(),
      },
      { createdBy: this.req['user']?.id },
    );

    const created = await this.repository.createYoloSynonym(synonym);
    return { synonym: created };
  }
}
