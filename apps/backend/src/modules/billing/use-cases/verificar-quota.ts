import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { VerificarQuotaQuery } from '../dtos/verificar-quota.input';
import { BillingReadRepository } from '../repositories/billing-read.repository';
import { mesAtual } from './meu-uso-mensal';

type Metrica = 'voos_mes' | 'levantamentos_mes' | 'itens_mes' | 'usuarios_ativos';

export interface VerificarQuotaResult {
  ok: boolean;
  usado: number;
  limite: number | null;
}

@Injectable()
export class VerificarQuota {
  constructor(
    private readRepository: BillingReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(input: VerificarQuotaQuery): Promise<VerificarQuotaResult> {
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = this.req['tenantId'] as string;
    const metrica = input.metrica as Metrica;
    const { mesInicio, mesFim } = mesAtual();

    const [uso, quotas] = await Promise.all([
      this.readRepository.findUsoMensal(clienteId, mesInicio, mesFim),
      this.readRepository.findQuotas(clienteId),
    ]);

    const usadoMap: Record<Metrica, number> = {
      voos_mes: uso.voosMes,
      levantamentos_mes: uso.levantamentosMes,
      itens_mes: uso.itensMes,
      usuarios_ativos: uso.usuariosAtivos,
    };

    const limiteMap: Record<Metrica, number | null | undefined> = {
      voos_mes: quotas?.voosMes,
      levantamentos_mes: quotas?.levantamentosMes,
      itens_mes: quotas?.itensMes,
      usuarios_ativos: quotas?.usuariosAtivos,
    };

    const usado = usadoMap[metrica];
    const limite = limiteMap[metrica] ?? null;

    return {
      ok: limite === null || usado <= limite,
      usado,
      limite,
    };
  }
}
