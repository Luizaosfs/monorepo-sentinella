import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';

import { FilterQuarteiraoInput } from '../dtos/filter-quarteirao.input';
import { QuarteiraoException } from '../errors/quarteirao.exception';
import { QuarteiraoReadRepository } from '../repositories/quarteirao-read.repository';

@Injectable()
export class FilterQuarteiroes {
  constructor(
    private repository: QuarteiraoReadRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(filters: FilterQuarteiraoInput) {
    const isAdmin = this.req['user']?.papeis?.includes('admin');
    if (
      filters.clienteId &&
      !isAdmin &&
      filters.clienteId !== this.req['tenantId']
    ) {
      throw QuarteiraoException.forbiddenTenant();
    }

    const clienteId = filters.clienteId ?? this.req['tenantId'];
    const merged: FilterQuarteiraoInput = {
      ...filters,
      ...(clienteId && { clienteId }),
    };
    const items = await this.repository.findAllQuarteiroes(merged);
    return { quarteiroes: items };
  }
}
