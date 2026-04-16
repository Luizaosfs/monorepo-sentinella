import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';

import { FilterReinspecaoInput } from '../dtos/filter-reinspecao.input';
import { ReinspecaoException } from '../errors/reinspecao.exception';
import { ReinspecaoReadRepository } from '../repositories/reinspecao-read.repository';

@Injectable()
export class FilterReinspecoes {
  constructor(
    private repository: ReinspecaoReadRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(filters: FilterReinspecaoInput) {
    const isAdmin = this.req['user']?.papeis?.includes('admin');
    if (
      filters.clienteId &&
      !isAdmin &&
      filters.clienteId !== this.req['tenantId']
    ) {
      throw ReinspecaoException.forbiddenTenant();
    }

    const clienteId = filters.clienteId ?? this.req['tenantId'];
    const merged: FilterReinspecaoInput = {
      ...filters,
      ...(clienteId && { clienteId }),
    };

    const items = await this.repository.findAll(merged);
    return { reinspecoes: items };
  }
}
