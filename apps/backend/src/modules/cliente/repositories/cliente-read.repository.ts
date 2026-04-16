import { Injectable } from '@nestjs/common';
import { PaginationProps } from 'src/shared/dtos/pagination-body';

import { FilterClienteInput } from '../dtos/filter-cliente.input';
import { Cliente, ClientePaginated } from '../entities/cliente';

export interface ClienteIntegracaoApiKey {
  id: string;
  clienteId: string;
  tipo: string;
  apiKey: string;
  apiKeyMasked: string | null;
  ativo: boolean;
  ambiente: string;
}

@Injectable()
export abstract class ClienteReadRepository {
  abstract findById(id: string): Promise<Cliente | null>;
  abstract findBySlug(slug: string): Promise<Cliente | null>;
  abstract findAll(filters: FilterClienteInput): Promise<Cliente[]>;
  abstract findPaginated(
    filters: FilterClienteInput,
    pagination: PaginationProps,
  ): Promise<ClientePaginated>;
  abstract findPorCoordenada(lat: number, lng: number): Promise<Cliente | null>;
  abstract findIntegracaoApiKey(id: string): Promise<ClienteIntegracaoApiKey | null>;
}
