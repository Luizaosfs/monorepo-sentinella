import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { PaginationProps } from '@shared/dtos/pagination-body';
import { Request } from 'express';

import { FilterVistoriaInput } from '../dtos/filter-vistoria.input';
import { VistoriaReadRepository } from '../repositories/vistoria-read.repository';

@Injectable()
export class PaginationVistoria {
  constructor(
    private repository: VistoriaReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(filters: FilterVistoriaInput, pagination: PaginationProps) {
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = this.req['tenantId'];
    return this.repository.findPaginated({ ...filters, clienteId }, pagination);
  }
}
