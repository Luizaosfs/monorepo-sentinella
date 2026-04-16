import { Injectable } from '@nestjs/common';

import { FilterUsuarioInput } from '../dtos/filter-usuario.input';
import { UsuarioReadRepository } from '../repositories/usuario-read.repository';

@Injectable()
export class FilterUsuario {
  constructor(private repository: UsuarioReadRepository) {}

  async execute(filters: FilterUsuarioInput) {
    const usuarios = await this.repository.findAll(filters);
    return { usuarios };
  }
}
