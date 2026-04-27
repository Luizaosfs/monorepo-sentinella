import { Injectable } from '@nestjs/common';
import { PaginationProps } from 'src/shared/dtos/pagination-body';

import { FilterRegiaoInput } from '../dtos/filter-regiao.input';
import { Regiao, RegiaoPaginated } from '../entities/regiao';

@Injectable()
export abstract class RegiaoReadRepository {
  abstract findById(id: string, clienteId: string | null): Promise<Regiao | null>;
  abstract findAll(filters: FilterRegiaoInput): Promise<Regiao[]>;
  abstract findPaginated(
    filters: FilterRegiaoInput,
    pagination: PaginationProps,
  ): Promise<RegiaoPaginated>;
}
