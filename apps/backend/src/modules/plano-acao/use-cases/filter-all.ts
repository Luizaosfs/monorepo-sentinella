import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { FilterPlanoAcaoAllInput } from '../dtos/filter-plano-acao.input';
import { PlanoAcaoReadRepository } from '../repositories/plano-acao-read.repository';

@Injectable()
export class FilterAllPlanoAcao {
  constructor(
    private repository: PlanoAcaoReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(filters: FilterPlanoAcaoAllInput) {
    const clienteId = filters.clienteId ?? (this.req['tenantId'] as string | undefined);
    const planosAcao = await this.repository.findAllIncludingInactive({
      ...filters,
      clienteId,
    });
    return { planosAcao };
  }
}
