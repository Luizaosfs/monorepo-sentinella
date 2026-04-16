import { Injectable } from '@nestjs/common';

import { PluvioException } from '../errors/pluvio.exception';
import { PluvioReadRepository } from '../repositories/pluvio-read.repository';
import { PluvioWriteRepository } from '../repositories/pluvio-write.repository';

@Injectable()
export class DeleteRun {
  constructor(
    private readRepository: PluvioReadRepository,
    private writeRepository: PluvioWriteRepository,
  ) {}

  async execute(id: string) {
    const run = await this.readRepository.findRunById(id);
    if (!run) throw PluvioException.runNotFound();

    await this.writeRepository.deleteRun(id);
  }
}
