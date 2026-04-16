import { Injectable } from '@nestjs/common';

import { CreateClientePlanoBody } from '../dtos/create-billing.body';
import { ClientePlano } from '../entities/billing';
import { BillingWriteRepository } from '../repositories/billing-write.repository';

@Injectable()
export class CreateClientePlano {
  constructor(private repository: BillingWriteRepository) {}

  async execute(input: CreateClientePlanoBody): Promise<{ clientePlano: ClientePlano }> {
    const entity = new ClientePlano(
      {
        clienteId: input.clienteId,
        planoId: input.planoId,
        dataInicio: input.dataInicio ?? new Date(),
        dataFim: input.dataFim,
        status: input.status ?? 'ativo',
        limitesPersonalizados: input.limitesPersonalizados,
        contratoRef: input.contratoRef,
        observacao: input.observacao,
        dataTrialFim: input.dataTrialFim,
      },
      {},
    );
    const created = await this.repository.createClientePlano(entity);
    return { clientePlano: created };
  }
}
