import { Injectable } from '@nestjs/common';

import { ConsumoLarvicidaQuery } from '../dtos/dashboard-analytics.input';
import {
  ConsumoLarvicidaRow,
  DashboardReadRepository,
} from '../repositories/dashboard-read.repository';

@Injectable()
export class ConsumoLarvicida {
  constructor(private readRepository: DashboardReadRepository) {}

  execute(clienteId: string, query: ConsumoLarvicidaQuery): Promise<ConsumoLarvicidaRow[]> {
    return this.readRepository.consumoLarvicida(clienteId, query.ciclo);
  }
}
