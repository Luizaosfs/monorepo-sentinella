import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope } from '@shared/security/access-scope.helpers';

import { FilterPlanoAcaoAllInput } from '../dtos/filter-plano-acao.input';
import { PlanoAcaoReadRepository } from '../repositories/plano-acao-read.repository';

@Injectable()
export class FilterAllPlanoAcao {
  constructor(
    private repository: PlanoAcaoReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(filters: FilterPlanoAcaoAllInput) {
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = getAccessScope(this.req).tenantId ?? undefined;
    const planosAcao = await this.repository.findAllIncludingInactive({
      ...filters,
      clienteId,
    });
    return { planosAcao };
  }
}
