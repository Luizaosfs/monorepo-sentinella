import { Injectable } from '@nestjs/common';

import { LevantamentoException } from '../errors/levantamento.exception';
import { LevantamentoReadRepository } from '../repositories/levantamento-read.repository';

@Injectable()
export class GetLevantamento {
  constructor(private repository: LevantamentoReadRepository) {}

  async execute(id: string) {
    const levantamento = await this.repository.findByIdComItens(id);
    if (!levantamento) throw LevantamentoException.notFound();
    return { levantamento };
  }
}
