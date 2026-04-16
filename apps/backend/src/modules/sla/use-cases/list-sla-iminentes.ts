import { Injectable } from '@nestjs/common';

import { SlaReadRepository } from '../repositories/sla-read.repository';

@Injectable()
export class ListSlaIminentes {
  constructor(private repository: SlaReadRepository) {}

  async execute(clienteId: string) {
    const iminentes = await this.repository.findIminentes(clienteId);
    return { iminentes };
  }
}
