import { Injectable } from '@nestjs/common';

import { LiraaQuery } from '../dtos/dashboard-analytics.input';
import {
  DashboardReadRepository,
  LiraaResult,
} from '../repositories/dashboard-read.repository';

@Injectable()
export class CalcularLiraa {
  constructor(private readRepository: DashboardReadRepository) {}

  execute(clienteId: string, query: LiraaQuery): Promise<LiraaResult> {
    return this.readRepository.calcularLiraa(clienteId, query.ciclo);
  }
}
