import { Injectable } from '@nestjs/common';

import { LevantamentoException } from '../errors/levantamento.exception';
import { LevantamentoReadRepository } from '../repositories/levantamento-read.repository';

@Injectable()
export class GetItem {
  constructor(private readRepository: LevantamentoReadRepository) {}

  async execute(itemId: string) {
    const item = await this.readRepository.findItemById(itemId);
    if (!item) throw LevantamentoException.itemNotFound();
    return { item };
  }
}
