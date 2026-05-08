import { Injectable } from '@nestjs/common';

import { CreatePluvioRunInput } from '../dtos/create-pluvio-run.body';
import { PluvioRun } from '../entities/pluvio';
import { PluvioWriteRepository } from '../repositories/pluvio-write.repository';

@Injectable()
export class CreateRun {
  constructor(private repository: PluvioWriteRepository) {}

  async execute(input: CreatePluvioRunInput, clienteId: string) {
    const run = new PluvioRun(
      {
        clienteId,
        dataReferencia: input.dtRef,
        total: input.totalBairros,
        status: input.status ?? 'pendente',
      },
      {},
    );

    const created = await this.repository.createRun(run);
    return { run: created };
  }
}
