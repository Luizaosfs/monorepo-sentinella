import { Injectable } from '@nestjs/common';
import { PaginationProps } from '@shared/dtos/pagination-body';

import { FilterClienteInput } from '../dtos/filter-cliente.input';
import { ClienteReadRepository } from '../repositories/cliente-read.repository';

@Injectable()
export class PaginationCliente {
  constructor(private repository: ClienteReadRepository) {}

  async execute(filters: FilterClienteInput, pagination: PaginationProps) {
    return this.repository.findPaginated(filters, pagination);
  }
}
