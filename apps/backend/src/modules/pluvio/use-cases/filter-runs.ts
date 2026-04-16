import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';

import { FilterPluvioRunInputType } from '../dtos/filter-pluvio-run.input';
import { PluvioReadRepository } from '../repositories/pluvio-read.repository';

@Injectable()
export class FilterRuns {
  constructor(
    private repository: PluvioReadRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(filters: FilterPluvioRunInputType) {
    const tenantId = this.req['tenantId'] as string | undefined;
    const clienteId = filters.clienteId ?? tenantId;

    const runs = await this.repository.findRuns({ ...filters, clienteId });
    return { runs };
  }
}
