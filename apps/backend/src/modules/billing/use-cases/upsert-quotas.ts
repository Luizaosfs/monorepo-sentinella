import { Injectable } from '@nestjs/common';

import { UpsertQuotasBody } from '../dtos/create-billing.body';
import { ClienteQuotas } from '../entities/billing';
import { BillingWriteRepository } from '../repositories/billing-write.repository';

@Injectable()
export class UpsertQuotas {
  constructor(private repository: BillingWriteRepository) {}

  async execute(clienteId: string, input: UpsertQuotasBody): Promise<{ quotas: ClienteQuotas }> {
    const entity = new ClienteQuotas(
      {
        clienteId,
        voosMes: input.voosMes,
        levantamentosMes: input.levantamentosMes,
        itensMes: input.itensMes,
        usuariosAtivos: input.usuariosAtivos,
        vistoriasMes: input.vistoriasMes,
        iaCallsMes: input.iaCallsMes,
        storageGb: input.storageGb,
      },
      {},
    );
    const quotas = await this.repository.upsertQuotas(entity);
    return { quotas };
  }
}
