import { Injectable } from '@nestjs/common';
import { PaginationProps } from '@shared/dtos/pagination-body';

import { FilterOperacaoInput } from '../dtos/filter-operacao.input';
import { Operacao, OperacaoPaginated } from '../entities/operacao';

@Injectable()
export abstract class OperacaoReadRepository {
  abstract findById(id: string, clienteId: string | null): Promise<Operacao | null>;
  abstract findByIdComEvidencias(id: string, clienteId: string | null): Promise<Operacao | null>;
  abstract findAll(filters: FilterOperacaoInput): Promise<Operacao[]>;
  abstract findPaginated(
    filters: FilterOperacaoInput,
    pagination: PaginationProps,
  ): Promise<OperacaoPaginated>;
  abstract findAtivaParaItem(
    clienteId: string,
    itemLevantamentoId: string,
  ): Promise<Operacao | null>;
  abstract countByStatus(clienteId: string): Promise<Record<string, number>>;
}
