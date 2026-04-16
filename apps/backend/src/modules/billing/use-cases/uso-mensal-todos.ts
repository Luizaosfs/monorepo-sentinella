import { Injectable } from '@nestjs/common';

import { UsoMensalComLimites, mesAtual, limitesDe } from './meu-uso-mensal';
import { BillingReadRepository } from '../repositories/billing-read.repository';

@Injectable()
export class UsoMensalTodos {
  constructor(private readRepository: BillingReadRepository) {}

  async execute(): Promise<UsoMensalComLimites[]> {
    const { mesInicio, mesFim } = mesAtual();

    const usos = await this.readRepository.findUsoMensalTodos(
      mesInicio,
      mesFim,
    );

    const quotasPorCliente = await Promise.all(
      usos.map((u) => this.readRepository.findQuotas(u.clienteId)),
    );

    return usos.map((uso, i) => ({
      ...uso,
      limites: limitesDe(quotasPorCliente[i]),
    }));
  }
}
