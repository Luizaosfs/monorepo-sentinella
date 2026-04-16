import { Injectable } from '@nestjs/common';

import { ClienteQuotas } from '../entities/billing';
import { BillingReadRepository } from '../repositories/billing-read.repository';

@Injectable()
export class GetQuotas {
  constructor(private repository: BillingReadRepository) {}

  async execute(clienteId: string): Promise<{ quotas: ClienteQuotas | null }> {
    const quotas = await this.repository.findQuotas(clienteId);
    return { quotas };
  }
}
