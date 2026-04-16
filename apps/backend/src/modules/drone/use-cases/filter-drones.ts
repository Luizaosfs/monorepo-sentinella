import { Injectable } from '@nestjs/common';

import { Drone } from '../entities/drone';
import { DroneReadRepository } from '../repositories/drone-read.repository';

@Injectable()
export class FilterDrones {
  constructor(private repository: DroneReadRepository) {}

  async execute(clienteId: string): Promise<{ items: Drone[] }> {
    const items = await this.repository.findDrones(clienteId);
    return { items };
  }
}
