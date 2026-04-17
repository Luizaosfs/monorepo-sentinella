import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { PaginationProps } from '@shared/dtos/pagination-body';
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
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = this.req['tenantId'];
    return this.repository.findPaginated({ ...filters, clienteId }, pagination);
  }
}
