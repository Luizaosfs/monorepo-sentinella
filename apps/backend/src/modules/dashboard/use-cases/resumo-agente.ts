import { Injectable } from '@nestjs/common';

import { ResumoAgenteQuery } from '../dtos/dashboard-analytics.input';
import {
  DashboardReadRepository,
  ResumoAgenteResult,
} from '../repositories/dashboard-read.repository';

@Injectable()
export class ResumoAgente {
  constructor(private readRepository: DashboardReadRepository) {}

  execute(clienteId: string, query: ResumoAgenteQuery): Promise<ResumoAgenteResult> {
    return this.readRepository.resumoAgente(clienteId, query.agenteId, query.ciclo);
  }
}
