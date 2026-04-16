import { Injectable } from '@nestjs/common';

import { Plano } from '../entities/billing';
import { BillingReadRepository } from '../repositories/billing-read.repository';

@Injectable()
export class FilterPlanos {
  constructor(private repository: BillingReadRepository) {}

  async execute(): Promise<{ items: Plano[] }> {
    const items = await this.repository.findPlanos();
    return { items };
  }
}
