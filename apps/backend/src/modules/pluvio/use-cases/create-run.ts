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
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = this.req['tenantId'] as string;

    const run = new PluvioRun(
      {
        clienteId,
        dataReferencia: input.dtRef,
        total: input.totalBairros,
        status: input.status ?? 'pendente',
      },
      { createdBy: this.req['user']?.id },
    );

    const created = await this.repository.createRun(run);
    return { run: created };
  }
}
