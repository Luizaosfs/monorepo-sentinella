import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { FilterPlanejamentoInput } from '../dtos/filter-planejamento.input';
import { PlanejamentoReadRepository } from '../repositories/planejamento-read.repository';

@Injectable()
export class FilterPlanejamento {
  constructor(
    private repository: PlanejamentoReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(filters: FilterPlanejamentoInput) {
    const clienteId = filters.clienteId ?? this.req['tenantId'];
    const planejamentos = await this.repository.findAll({
      ...filters,
      clienteId,
    });
    return { planejamentos };
  }
}
