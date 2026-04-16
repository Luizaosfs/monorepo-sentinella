import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { FilterImportLogInput } from '../dtos/filter-import-log.input';
import { ImportLogReadRepository } from '../repositories/import-log-read.repository';

@Injectable()
export class FilterImports {
  constructor(
    private repository: ImportLogReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(filters: FilterImportLogInput) {
    const isAdmin = this.req['user']?.papeis?.includes('admin');
    const clienteId = isAdmin ? filters.clienteId : this.req['tenantId'];

    const items = await this.repository.findAll({
      ...filters,
      clienteId,
    });

    return { items };
  }
}
