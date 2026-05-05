import { Injectable } from '@nestjs/common';

import { ResumoRegionalQuery } from '../dtos/dashboard-analytics.input';
import {
  DashboardReadRepository,
  ResumoRegionalRow,
} from '../repositories/dashboard-read.repository';

@Injectable()
export class ResumoRegional {
  constructor(private readRepository: DashboardReadRepository) {}

  execute(clienteId: string, query: ResumoRegionalQuery): Promise<ResumoRegionalRow[]> {
    return this.readRepository.resumoRegional(clienteId, query.ciclo, query.de, query.ate);
  }
}
