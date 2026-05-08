import { Injectable } from '@nestjs/common';

import { UpsertPluvioItemInput } from '../dtos/upsert-pluvio-item.body';
import { PluvioItem } from '../entities/pluvio';
import { PluvioWriteRepository } from '../repositories/pluvio-write.repository';

@Injectable()
export class BulkInsertItems {
  constructor(private repository: PluvioWriteRepository) {}

  async execute(inputs: UpsertPluvioItemInput[]) {
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
          {},
        ),
    );

    await this.repository.bulkInsertItems(items);
    return { count: items.length };
  }
}
