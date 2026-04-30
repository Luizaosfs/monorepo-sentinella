import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';

import { PluvioException } from '../errors/pluvio.exception';
import { PluvioReadRepository } from '../repositories/pluvio-read.repository';

@Injectable()
export class LatestRun {
  constructor(
    private repository: PluvioReadRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute() {
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const id = requireTenantId(getAccessScope(this.req));

    const run = await this.repository.findLatestRun(id);
    if (!run) throw PluvioException.runNotFound();

    return { run };
  }
}
