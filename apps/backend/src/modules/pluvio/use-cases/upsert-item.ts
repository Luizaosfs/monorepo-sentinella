import { Injectable } from '@nestjs/common';

import { UpsertPluvioItemInput } from '../dtos/upsert-pluvio-item.body';
import { PluvioItem } from '../entities/pluvio';
import { PluvioException } from '../errors/pluvio.exception';
import { PluvioReadRepository } from '../repositories/pluvio-read.repository';
import { PluvioWriteRepository } from '../repositories/pluvio-write.repository';

@Injectable()
export class UpsertItem {
  constructor(
    private readRepository: PluvioReadRepository,
    private writeRepository: PluvioWriteRepository,
  ) {}

  async execute(input: UpsertPluvioItemInput) {
    const run = await this.readRepository.findRunById(input.runId);
    if (!run) throw PluvioException.runNotFound();

    const item = new PluvioItem(
      {
        runId: input.runId,
        regiaoId: input.regiaoId,
        imovelId: input.imovelId,
        precipitacao: input.precipitacao,
        nivelRisco: input.nivelRisco,
      },
      { id: input.id },
    );

    const upserted = await this.writeRepository.upsertItem(item);
    return { item: upserted };
  }
}
