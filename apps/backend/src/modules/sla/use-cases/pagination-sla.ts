import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { PaginationProps } from '@shared/dtos/pagination-body';
import { Request } from 'express';

import { FilterSlaInput } from '../dtos/filter-sla.input';
import { SlaReadRepository } from '../repositories/sla-read.repository';

@Injectable()
export class PaginationSla {
  constructor(
    private repository: SlaReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(filters: FilterSlaInput, pagination: PaginationProps) {
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = this.req['tenantId'];
    return this.repository.findPaginated({ ...filters, clienteId }, pagination);
  }
}
