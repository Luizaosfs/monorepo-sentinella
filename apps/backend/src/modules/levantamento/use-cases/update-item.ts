import { Injectable } from '@nestjs/common';

import { UpdateItemBody } from '../dtos/update-item.body';
import { LevantamentoException } from '../errors/levantamento.exception';
import { LevantamentoReadRepository } from '../repositories/levantamento-read.repository';
import { LevantamentoWriteRepository } from '../repositories/levantamento-write.repository';

@Injectable()
export class UpdateItem {
  constructor(
    private readRepository: LevantamentoReadRepository,
    private writeRepository: LevantamentoWriteRepository,
  ) {}

  async execute(itemId: string, input: UpdateItemBody) {
    const item = await this.readRepository.findItemById(itemId);
    if (!item) throw LevantamentoException.itemNotFound();
    await this.writeRepository.updateItem(itemId, input);
    const updated = await this.readRepository.findItemById(itemId);
    return { item: updated! };
  }
}
