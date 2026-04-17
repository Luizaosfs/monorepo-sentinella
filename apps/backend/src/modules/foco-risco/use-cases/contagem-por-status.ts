import { Injectable } from '@nestjs/common';

import { FocoRiscoReadRepository } from '../repositories/foco-risco-read.repository';

@Injectable()
export class ContagemPorStatus {
  constructor(private repository: FocoRiscoReadRepository) {}

  async execute(clienteId: string): Promise<Record<string, number>> {
    return this.repository.findContagemPorStatus(clienteId);
  }
}
