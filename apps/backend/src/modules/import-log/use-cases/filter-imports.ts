import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope } from '@shared/security/access-scope.helpers';

import { FilterImportLogInput } from '../dtos/filter-import-log.input';
import { ImportLogReadRepository } from '../repositories/import-log-read.repository';

@Injectable()
export class FilterImports {
  constructor(
    private repository: ImportLogReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(filters: FilterImportLogInput) {
    const isAdmin = this.req['user']?.isPlatformAdmin ?? false;
    const clienteId = isAdmin ? filters.clienteId : (getAccessScope(this.req).tenantId ?? undefined);

    const items = await this.repository.findAll({
      ...filters,
      clienteId,
    });

    return { items };
  }
}
