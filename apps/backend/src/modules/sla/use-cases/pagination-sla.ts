import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { PaginationProps } from '@shared/dtos/pagination-body';
import { Request } from 'express';
import { getAccessScope, getClienteIdsPermitidos } from '@shared/security/access-scope.helpers';

import { FilterSlaInput } from '../dtos/filter-sla.input';
import { SlaReadRepository } from '../repositories/sla-read.repository';

@Injectable()
export class PaginationSla {
  constructor(
    private repository: SlaReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(filters: FilterSlaInput, pagination: PaginationProps) {
    const clienteIds = getClienteIdsPermitidos(getAccessScope(this.req));
    const clienteId = clienteIds !== null ? clienteIds[0] : undefined;
    return this.repository.findPaginated({ ...filters, clienteId }, pagination);
  }
}
