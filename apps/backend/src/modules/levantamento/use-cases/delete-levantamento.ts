import { Injectable } from '@nestjs/common';

import { LevantamentoException } from '../errors/levantamento.exception';
import { LevantamentoReadRepository } from '../repositories/levantamento-read.repository';
import { LevantamentoWriteRepository } from '../repositories/levantamento-write.repository';

@Injectable()
export class DeleteLevantamento {
  constructor(
    private readRepository: LevantamentoReadRepository,
    private writeRepository: LevantamentoWriteRepository,
  ) {}

  async execute(id: string) {
    const levantamento = await this.readRepository.findById(id);
    if (!levantamento) throw LevantamentoException.notFound();
    await this.writeRepository.delete(id);
  }
}
