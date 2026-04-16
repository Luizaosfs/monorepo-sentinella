import { Injectable } from '@nestjs/common';

import { DashboardWriteRepository } from '../repositories/dashboard-write.repository';

@Injectable()
export class ResolverAlert {
  constructor(private repository: DashboardWriteRepository) {}

  async execute(id: string): Promise<void> {
    await this.repository.resolverAlert(id);
  }
}
