import { Injectable } from '@nestjs/common';
import { PaginationProps } from 'src/shared/dtos/pagination-body';

import { FilterUsuarioInput } from '../dtos/filter-usuario.input';
import { Usuario, UsuarioPaginated } from '../entities/usuario';

@Injectable()
export abstract class UsuarioReadRepository {
  abstract findById(id: string): Promise<Usuario | null>;
  abstract findByEmail(email: string): Promise<Usuario | null>;
  abstract findAll(filters: FilterUsuarioInput): Promise<Usuario[]>;
  abstract findPaginated(
    filters: FilterUsuarioInput,
    pagination: PaginationProps,
  ): Promise<UsuarioPaginated>;
  abstract findByClienteId(clienteId: string): Promise<Usuario[]>;
  abstract findPapeisCliente(clienteId: string | null): Promise<{ usuario_id: string; papel: string }[]>;
}
