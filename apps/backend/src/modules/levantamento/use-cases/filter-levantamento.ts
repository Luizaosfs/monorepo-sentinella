import { Injectable } from '@nestjs/common';

import { FilterLevantamentoInput } from '../dtos/filter-levantamento.input';
import { LevantamentoReadRepository } from '../repositories/levantamento-read.repository';

@Injectable()
export class FilterLevantamento {
  constructor(private repository: LevantamentoReadRepository) {}

  async execute(filters: FilterLevantamentoInput) {
    const levantamentos = await this.repository.findAll(filters);
    return { levantamentos };
  }
}
