import { Injectable } from '@nestjs/common';

import { PluvioException } from '../errors/pluvio.exception';
import { PluvioReadRepository } from '../repositories/pluvio-read.repository';

@Injectable()
export class FilterItems {
  constructor(private repository: PluvioReadRepository) {}

  async execute(runId: string) {
    const run = await this.repository.findRunById(runId);
    if (!run) throw PluvioException.runNotFound();

    const items = await this.repository.findItemsByRunId(runId);
    return { items };
  }
}
