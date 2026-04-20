import { Injectable } from '@nestjs/common';

import { ClienteQuotas } from '../entities/billing';
import {
  BillingReadRepository,
  UsoMensal,
} from '../repositories/billing-read.repository';

export interface UsoMensalComLimites extends UsoMensal {
  limites: {
    voosMes: number | null;
    levantamentosMes: number | null;
    itensMes: number | null;
    usuariosAtivos: number | null;
  };
}

export function mesAtual(): { mesInicio: Date; mesFim: Date } {
  const now = new Date();
  const mesInicio = new Date(now.getFullYear(), now.getMonth(), 1);
  const mesFim = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
  return { mesInicio, mesFim };
}

export function limitesDe(quotas: ClienteQuotas | null | undefined) {
  return {
    voosMes: quotas?.voosMes ?? null,
    levantamentosMes: quotas?.levantamentosMes ?? null,
    itensMes: quotas?.itensMes ?? null,
    usuariosAtivos: quotas?.usuariosAtivos ?? null,
  };
}

@Injectable()
export class MeuUsoMensal {
  constructor(private readRepository: BillingReadRepository) {}

  async execute(clienteId: string): Promise<UsoMensalComLimites> {
    const { mesInicio, mesFim } = mesAtual();

    const [uso, quotas] = await Promise.all([
      this.readRepository.findUsoMensal(clienteId, mesInicio, mesFim),
      this.readRepository.findQuotas(clienteId),
    ]);

    return { ...uso, limites: limitesDe(quotas) };
  }
}
