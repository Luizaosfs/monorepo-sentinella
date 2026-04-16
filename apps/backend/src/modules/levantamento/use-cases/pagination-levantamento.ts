import { Injectable } from '@nestjs/common';
import { PaginationProps } from '@shared/dtos/pagination-body';

import { FilterLevantamentoInput } from '../dtos/filter-levantamento.input';
import { LevantamentoReadRepository } from '../repositories/levantamento-read.repository';

@Injectable()
export class PaginationLevantamento {
  constructor(private repository: LevantamentoReadRepository) {}

  async execute(filters: FilterLevantamentoInput, pagination: PaginationProps) {
    return this.repository.findPaginated(filters, pagination);
  }
}
