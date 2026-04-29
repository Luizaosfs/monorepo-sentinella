import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { PaginationProps } from '@shared/dtos/pagination-body';
import { getAccessScope, getClienteIdsPermitidos } from '@shared/security/access-scope.helpers';
import { Request } from 'express';

import { FilterOperacaoInput } from '../dtos/filter-operacao.input';
import { OperacaoReadRepository } from '../repositories/operacao-read.repository';

@Injectable()
export class PaginationOperacao {
  constructor(
    private repository: OperacaoReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(filters: FilterOperacaoInput, pagination: PaginationProps) {
    const clienteIds = getClienteIdsPermitidos(getAccessScope(this.req));
    const clienteId = clienteIds !== null ? clienteIds[0] : undefined;
    return this.repository.findPaginated({ ...filters, clienteId }, pagination);
  }
}
