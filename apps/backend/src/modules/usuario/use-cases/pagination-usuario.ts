import { Injectable } from '@nestjs/common';
import { PaginationProps } from '@shared/dtos/pagination-body';

import { FilterUsuarioInput } from '../dtos/filter-usuario.input';
import { UsuarioReadRepository } from '../repositories/usuario-read.repository';

@Injectable()
export class PaginationUsuario {
  constructor(private repository: UsuarioReadRepository) {}

  async execute(filters: FilterUsuarioInput, pagination: PaginationProps) {
    return this.repository.findPaginated(filters, pagination);
  }
}
