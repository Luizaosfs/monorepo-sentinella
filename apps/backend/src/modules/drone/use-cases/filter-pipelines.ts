import { Injectable } from '@nestjs/common';

import { PipelineRun } from '../entities/drone';
import { DroneReadRepository } from '../repositories/drone-read.repository';

@Injectable()
export class FilterPipelines {
  constructor(private repository: DroneReadRepository) {}

  async execute(clienteId: string): Promise<{ items: PipelineRun[] }> {
    const items = await this.repository.findPipelines(clienteId);
    return { items };
  }
}
