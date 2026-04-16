import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';

import { CreatePluvioRunInput } from '../dtos/create-pluvio-run.body';
import { PluvioRun } from '../entities/pluvio';
import { PluvioWriteRepository } from '../repositories/pluvio-write.repository';

@Injectable()
export class CreateRun {
  constructor(
    private repository: PluvioWriteRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(input: CreatePluvioRunInput) {
    const tenantId = this.req['tenantId'] as string | undefined;
    const clienteId = input.clienteId ?? tenantId!;

    const run = new PluvioRun(
      {
        clienteId,
        dataReferencia: input.dataReferencia,
        total: input.total,
        status: input.status ?? 'pendente',
      },
      { createdBy: this.req['user']?.id },
    );

    const created = await this.repository.createRun(run);
    return { run: created };
  }
}
