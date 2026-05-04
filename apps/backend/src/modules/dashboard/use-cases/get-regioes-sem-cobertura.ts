import { Injectable } from '@nestjs/common';

import { DashboardReadRepository } from '../repositories/dashboard-read.repository';

@Injectable()
export class GetRegioesSemCobertura {
  constructor(private repository: DashboardReadRepository) {}

  async execute(clienteId: string) {
    const regioes = await this.repository.getRegioesSemCobertura(clienteId);
    return { regioes };
  }
}
