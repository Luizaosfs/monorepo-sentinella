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
    const tenantId = this.req['tenantId'] as string | undefined;
    const clienteId = input.clienteId ?? tenantId!;

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
