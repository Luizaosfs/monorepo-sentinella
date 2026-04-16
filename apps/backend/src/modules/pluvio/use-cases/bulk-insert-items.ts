import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';

import { UpsertPluvioItemInput } from '../dtos/upsert-pluvio-item.body';
import { PluvioItem } from '../entities/pluvio';
import { PluvioWriteRepository } from '../repositories/pluvio-write.repository';

@Injectable()
export class BulkInsertItems {
  constructor(
    private repository: PluvioWriteRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(inputs: UpsertPluvioItemInput[]) {
    const createdBy = this.req['user']?.id;

    const items = inputs.map(
      (input) =>
        new PluvioItem(
          {
            runId: input.runId,
            regiaoId: input.regiaoId,
            imovelId: input.imovelId,
            precipitacao: input.precipitacao,
            nivelRisco: input.nivelRisco,
          },
          { createdBy },
        ),
    );

    await this.repository.bulkInsertItems(items);
    return { count: items.length };
  }
}
