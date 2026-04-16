import { Injectable } from '@nestjs/common';
import { PaginationProps } from '@shared/dtos/pagination-body';

import { FilterImovelInput } from '../dtos/filter-imovel.input';
import { ImovelReadRepository } from '../repositories/imovel-read.repository';

@Injectable()
export class PaginationImovel {
  constructor(private repository: ImovelReadRepository) {}

  async execute(filters: FilterImovelInput, pagination: PaginationProps) {
    return this.repository.findPaginated(filters, pagination);
  }
}
