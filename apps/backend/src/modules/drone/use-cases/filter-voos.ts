import { Injectable } from '@nestjs/common';

import { Voo } from '../entities/drone';
import { DroneReadRepository } from '../repositories/drone-read.repository';

@Injectable()
export class FilterVoos {
  constructor(private repository: DroneReadRepository) {}

  async execute(clienteId: string): Promise<{ items: Voo[] }> {
    const items = await this.repository.findVoos(clienteId);
    return { items };
  }
}
