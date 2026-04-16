import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';

import { PluvioException } from '../errors/pluvio.exception';
import { PluvioReadRepository } from '../repositories/pluvio-read.repository';

@Injectable()
export class LatestRun {
  constructor(
    private repository: PluvioReadRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(clienteId?: string) {
    const tenantId = this.req['tenantId'] as string | undefined;
    const id = clienteId ?? tenantId!;

    const run = await this.repository.findLatestRun(id);
    if (!run) throw PluvioException.runNotFound();

    return { run };
  }
}
