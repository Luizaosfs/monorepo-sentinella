import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';

import { FilterDistribuicaoInput } from '../dtos/filter-distribuicao.input';
import { QuarteiraoException } from '../errors/quarteirao.exception';
import { QuarteiraoReadRepository } from '../repositories/quarteirao-read.repository';

@Injectable()
export class FilterDistribuicoes {
  constructor(
    private repository: QuarteiraoReadRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(filters: FilterDistribuicaoInput) {
    const isAdmin = this.req['user']?.papeis?.includes('admin');
    if (
      filters.clienteId &&
      !isAdmin &&
      filters.clienteId !== this.req['tenantId']
    ) {
      throw QuarteiraoException.forbiddenTenant();
    }

    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = this.req['tenantId'];
    const merged: FilterDistribuicaoInput = {
      ...filters,
      ...(clienteId != null && { clienteId }),
    };
    const items = await this.repository.findAllDistribuicoes(merged);
    return { distribuicoes: items };
  }
}
