import { Injectable } from '@nestjs/common';

import { ClientePlano } from '../entities/billing';
import { BillingException } from '../errors/billing.exception';
import { BillingReadRepository } from '../repositories/billing-read.repository';

@Injectable()
export class GetClientePlano {
  constructor(private repository: BillingReadRepository) {}

  async execute(clienteId: string): Promise<{ clientePlano: ClientePlano }> {
    const clientePlano = await this.repository.findClientePlano(clienteId);
    if (!clientePlano) throw BillingException.clientePlanoNotFound();
    return { clientePlano };
  }
}
