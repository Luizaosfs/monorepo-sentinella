import { Injectable } from '@nestjs/common';

import { RelatorioGerado } from '../entities/dashboard';
import { DashboardReadRepository } from '../repositories/dashboard-read.repository';

@Injectable()
export class FilterRelatorios {
  constructor(private repository: DashboardReadRepository) {}

  async execute(clienteId: string): Promise<{ items: RelatorioGerado[] }> {
    const items = await this.repository.findRelatorios(clienteId);
    return { items };
  }
}
