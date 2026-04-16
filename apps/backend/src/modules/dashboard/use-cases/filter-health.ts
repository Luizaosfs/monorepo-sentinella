import { Injectable } from '@nestjs/common';

import { SystemHealthLog } from '../entities/dashboard';
import { DashboardReadRepository } from '../repositories/dashboard-read.repository';

@Injectable()
export class FilterHealth {
  constructor(private repository: DashboardReadRepository) {}

  async execute(limit = 50): Promise<{ items: SystemHealthLog[] }> {
    const items = await this.repository.findHealthLogs(limit);
    return { items };
  }
}
