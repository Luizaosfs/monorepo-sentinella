import { Injectable } from '@nestjs/common';

import { ReinspecaoReadRepository } from '../repositories/reinspecao-read.repository';

@Injectable()
export class CountReinspecoesPendentes {
  constructor(private repo: ReinspecaoReadRepository) {}

  async execute(clienteId: string, agenteId?: string): Promise<number> {
    return this.repo.countPendentes(clienteId, agenteId);
  }
}
