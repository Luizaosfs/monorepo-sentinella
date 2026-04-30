import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope } from '@shared/security/access-scope.helpers';

import { FilterPlanoAcaoInput } from '../dtos/filter-plano-acao.input';
import { PlanoAcaoReadRepository } from '../repositories/plano-acao-read.repository';

@Injectable()
export class FilterPlanoAcao {
  constructor(
    private repository: PlanoAcaoReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(filters: FilterPlanoAcaoInput) {
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = getAccessScope(this.req).tenantId ?? undefined;
    const planosAcao = await this.repository.findAllActive({
      ...filters,
      clienteId,
    });
    return { planosAcao };
  }
}
