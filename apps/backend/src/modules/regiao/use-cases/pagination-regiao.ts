import { Injectable } from '@nestjs/common';
import { PaginationProps } from '@shared/dtos/pagination-body';

import { FilterRegiaoInput } from '../dtos/filter-regiao.input';
import { RegiaoReadRepository } from '../repositories/regiao-read.repository';

@Injectable()
export class PaginationRegiao {
  constructor(private repository: RegiaoReadRepository) {}

  async execute(filters: FilterRegiaoInput, pagination: PaginationProps) {
    return this.repository.findPaginated(filters, pagination);
  }
}
