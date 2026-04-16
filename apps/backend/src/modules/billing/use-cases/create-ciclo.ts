import { Injectable } from '@nestjs/common';

import { CreateCicloBody } from '../dtos/create-billing.body';
import { BillingCiclo } from '../entities/billing';
import { BillingWriteRepository } from '../repositories/billing-write.repository';

@Injectable()
export class CreateCiclo {
  constructor(private repository: BillingWriteRepository) {}

  async execute(input: CreateCicloBody): Promise<{ ciclo: BillingCiclo }> {
    const entity = new BillingCiclo(
      {
        clienteId: input.clienteId,
        clientePlanoId: input.clientePlanoId,
        periodoInicio: input.periodoInicio,
        periodoFim: input.periodoFim,
        status: 'aberto',
        valorBase: input.valorBase,
        valorExcedente: 0,
        observacao: input.observacao,
      },
      {},
    );
    const created = await this.repository.createCiclo(entity);
    return { ciclo: created };
  }
}
