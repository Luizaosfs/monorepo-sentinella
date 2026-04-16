import { Injectable } from '@nestjs/common';

import { ResumoDiario } from '../entities/dashboard';
import { DashboardReadRepository } from '../repositories/dashboard-read.repository';

@Injectable()
export class FilterResumos {
  constructor(private repository: DashboardReadRepository) {}

  async execute(clienteId: string, limit = 30): Promise<{ items: ResumoDiario[] }> {
    const items = await this.repository.findResumos(clienteId, limit);
    return { items };
  }
}
