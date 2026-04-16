import { Injectable } from '@nestjs/common';

import { SystemAlert } from '../entities/dashboard';
import { DashboardReadRepository } from '../repositories/dashboard-read.repository';

@Injectable()
export class FilterAlerts {
  constructor(private repository: DashboardReadRepository) {}

  async execute(resolvido?: boolean): Promise<{ items: SystemAlert[] }> {
    const items = await this.repository.findAlerts(resolvido);
    return { items };
  }
}
