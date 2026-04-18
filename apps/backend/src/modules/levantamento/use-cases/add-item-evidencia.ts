import { Injectable } from '@nestjs/common';

import { AddItemEvidenciaBody } from '../dtos/add-item-evidencia.body';
import { LevantamentoException } from '../errors/levantamento.exception';
import { LevantamentoReadRepository } from '../repositories/levantamento-read.repository';
import { LevantamentoWriteRepository } from '../repositories/levantamento-write.repository';

@Injectable()
export class AddItemEvidencia {
  constructor(
    private readRepository: LevantamentoReadRepository,
    private writeRepository: LevantamentoWriteRepository,
  ) {}

  async execute(itemId: string, input: AddItemEvidenciaBody) {
    const item = await this.readRepository.findItemById(itemId);
    if (!item) throw LevantamentoException.itemNotFound();
    const evidencia = await this.writeRepository.addItemEvidencia(itemId, input);
    return { evidencia };
  }
}
