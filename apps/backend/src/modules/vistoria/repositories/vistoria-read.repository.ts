import { Injectable } from '@nestjs/common';
import { PaginationProps } from '@shared/dtos/pagination-body';

import { FilterVistoriaInput } from '../dtos/filter-vistoria.input';
import { Vistoria, VistoriaPaginated } from '../entities/vistoria';

@Injectable()
export abstract class VistoriaReadRepository {
  abstract findById(id: string): Promise<Vistoria | null>;
  abstract findByIdComDetalhes(id: string): Promise<Vistoria | null>;
  abstract findAll(filters: FilterVistoriaInput): Promise<Vistoria[]>;
  abstract findPaginated(
    filters: FilterVistoriaInput,
    pagination: PaginationProps,
  ): Promise<VistoriaPaginated>;
  abstract count(filters: FilterVistoriaInput): Promise<number>;
}
