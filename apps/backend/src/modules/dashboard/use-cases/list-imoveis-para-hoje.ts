import { Injectable } from '@nestjs/common';

import { DashboardReadRepository } from '../repositories/dashboard-read.repository';

@Injectable()
export class ListImoveisParaHoje {
  constructor(private repository: DashboardReadRepository) {}

  async execute(clienteId: string, limit = 30) {
    const items = await this.repository.listImoveisParaHoje(clienteId, limit);
    return { items };
  }
}
