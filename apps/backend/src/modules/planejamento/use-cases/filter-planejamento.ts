import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope } from '@shared/security/access-scope.helpers';

import { FilterPlanejamentoInput } from '../dtos/filter-planejamento.input';
import { PlanejamentoReadRepository } from '../repositories/planejamento-read.repository';

@Injectable()
export class FilterPlanejamento {
  constructor(
    private repository: PlanejamentoReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(filters: FilterPlanejamentoInput) {
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = getAccessScope(this.req).tenantId ?? undefined;
    const planejamentos = await this.repository.findAll({
      ...filters,
      clienteId,
    });
    return { planejamentos };
  }
}
