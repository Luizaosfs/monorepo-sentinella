import { Injectable } from '@nestjs/common';

import { FilterClienteInput } from '../dtos/filter-cliente.input';
import { ClienteReadRepository } from '../repositories/cliente-read.repository';

@Injectable()
export class FilterCliente {
  constructor(private repository: ClienteReadRepository) {}

  async execute(filters: FilterClienteInput) {
    const clientes = await this.repository.findAll(filters);
    return { clientes };
  }
}
