import { Injectable } from '@nestjs/common';

import { DashboardReadRepository } from '../repositories/dashboard-read.repository';

@Injectable()
export class GetCentralKpis {
  constructor(private repository: DashboardReadRepository) {}

  async execute(clienteId: string) {
    const kpis = await this.repository.getCentralKpis(clienteId);
    return { kpis };
  }
}
