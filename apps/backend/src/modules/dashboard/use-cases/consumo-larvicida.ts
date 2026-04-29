import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';

import { ConsumoLarvicidaQuery } from '../dtos/dashboard-analytics.input';
import {
  ConsumoLarvicidaRow,
  DashboardReadRepository,
} from '../repositories/dashboard-read.repository';

@Injectable()
export class ConsumoLarvicida {
  constructor(
    private readRepository: DashboardReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(query: ConsumoLarvicidaQuery): Promise<ConsumoLarvicidaRow[]> {
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = requireTenantId(getAccessScope(this.req));
    return this.readRepository.consumoLarvicida(clienteId, query.ciclo);
  }
}
