import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { FilterSlaInput } from '../dtos/filter-sla.input';
import { SlaReadRepository } from '../repositories/sla-read.repository';

@Injectable()
export class ListSla {
  constructor(
    private repository: SlaReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(filters: FilterSlaInput) {
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = this.req['tenantId'];
    const slas = await this.repository.findAll({ ...filters, clienteId });
    return { slas };
  }
}
