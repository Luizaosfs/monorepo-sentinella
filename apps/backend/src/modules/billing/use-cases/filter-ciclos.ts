import { Injectable } from '@nestjs/common';

import { BillingCiclo } from '../entities/billing';
import { BillingReadRepository } from '../repositories/billing-read.repository';

@Injectable()
export class FilterCiclos {
  constructor(private repository: BillingReadRepository) {}

  async execute(clienteId: string): Promise<{ items: BillingCiclo[] }> {
    const items = await this.repository.findCiclos(clienteId);
    return { items };
  }
}
