import { Injectable } from '@nestjs/common';

import { ComparativoAgentesQuery } from '../dtos/dashboard-analytics.input';
import {
  AgenteStat,
  DashboardReadRepository,
} from '../repositories/dashboard-read.repository';

@Injectable()
export class ComparativoAgentes {
  constructor(private readRepository: DashboardReadRepository) {}

  execute(clienteId: string, query: ComparativoAgentesQuery): Promise<AgenteStat[]> {
    return this.readRepository.comparativoAgentes(clienteId, query.ciclo);
  }
}
