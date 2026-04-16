import { Injectable } from '@nestjs/common';

import { PluvioException } from '../errors/pluvio.exception';
import { PluvioReadRepository } from '../repositories/pluvio-read.repository';
import { PluvioWriteRepository } from '../repositories/pluvio-write.repository';

@Injectable()
export class UpdateRunTotal {
  constructor(
    private readRepository: PluvioReadRepository,
    private writeRepository: PluvioWriteRepository,
  ) {}

  async execute(id: string, total: number) {
    const run = await this.readRepository.findRunById(id);
    if (!run) throw PluvioException.runNotFound();

    run.total = total;
    run.updatedAt = new Date();

    await this.writeRepository.saveRun(run);
    return { run };
  }
}
