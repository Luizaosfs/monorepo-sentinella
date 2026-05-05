import { Injectable } from '@nestjs/common';

import { PluvioException } from '../errors/pluvio.exception';
import { PluvioReadRepository } from '../repositories/pluvio-read.repository';

@Injectable()
export class LatestRun {
  constructor(private repository: PluvioReadRepository) {}

  async execute(clienteId: string) {
    const run = await this.repository.findLatestRun(clienteId);
    if (!run) throw PluvioException.runNotFound();

    return { run };
  }
}
