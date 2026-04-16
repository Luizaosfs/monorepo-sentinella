import { Injectable } from '@nestjs/common';

import { PluvioException } from '../errors/pluvio.exception';
import { PluvioReadRepository } from '../repositories/pluvio-read.repository';
import { PluvioWriteRepository } from '../repositories/pluvio-write.repository';

@Injectable()
export class DeleteItem {
  constructor(
    private readRepository: PluvioReadRepository,
    private writeRepository: PluvioWriteRepository,
  ) {}

  async execute(id: string) {
    const item = await this.readRepository.findItemById(id);
    if (!item) throw PluvioException.itemNotFound();

    await this.writeRepository.deleteItem(id);
  }
}
