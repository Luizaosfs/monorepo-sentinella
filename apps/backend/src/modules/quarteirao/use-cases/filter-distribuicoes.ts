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

    const clienteId = filters.clienteId ?? this.req['tenantId'];
    if (!clienteId) {
      throw QuarteiraoException.badRequest();
    }
    const merged: FilterDistribuicaoInput = {
      ...filters,
      clienteId,
    };
    const items = await this.repository.findAllDistribuicoes(merged);
    return { distribuicoes: items };
  }
}
