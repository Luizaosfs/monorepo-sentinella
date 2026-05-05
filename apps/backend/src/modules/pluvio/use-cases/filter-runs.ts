import { Injectable } from '@nestjs/common';

import { FilterPluvioRunInputType } from '../dtos/filter-pluvio-run.input';
import { PluvioReadRepository } from '../repositories/pluvio-read.repository';

@Injectable()
export class FilterRuns {
  constructor(private repository: PluvioReadRepository) {}

  async execute(filters: FilterPluvioRunInputType, clienteId?: string) {
    const runs = await this.repository.findRuns({ ...filters, clienteId });
    return { runs };
  }
}
