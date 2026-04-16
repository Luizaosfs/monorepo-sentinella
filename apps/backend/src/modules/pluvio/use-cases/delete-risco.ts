import { Injectable } from '@nestjs/common';

import { PluvioException } from '../errors/pluvio.exception';
import { PluvioReadRepository } from '../repositories/pluvio-read.repository';
import { PluvioWriteRepository } from '../repositories/pluvio-write.repository';

@Injectable()
export class DeleteRisco {
  constructor(
    private readRepository: PluvioReadRepository,
    private writeRepository: PluvioWriteRepository,
  ) {}

  async execute(id: string) {
    const risco = await this.readRepository.findRiscoById(id);
    if (!risco) throw PluvioException.notFound();

    await this.writeRepository.deleteRisco(id);
  }
}
