import { Injectable } from '@nestjs/common';
import { PaginationProps } from '@shared/dtos/pagination-body';

import { FilterFocoRiscoInput } from '../dtos/filter-foco-risco.input';
import { FocoRiscoReadRepository } from '../repositories/foco-risco-read.repository';

@Injectable()
export class PaginationFocoRisco {
  constructor(private repository: FocoRiscoReadRepository) {}

  async execute(filters: FilterFocoRiscoInput, pagination: PaginationProps) {
    return this.repository.findPaginated(filters, pagination);
  }
}
