import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';

import { ResumoAgenteQuery } from '../dtos/dashboard-analytics.input';
import {
  DashboardReadRepository,
  ResumoAgenteResult,
} from '../repositories/dashboard-read.repository';

@Injectable()
export class ResumoAgente {
  constructor(
    private readRepository: DashboardReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(query: ResumoAgenteQuery): Promise<ResumoAgenteResult> {
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = requireTenantId(getAccessScope(this.req));
    return this.readRepository.resumoAgente(
      clienteId,
      query.agenteId,
      query.ciclo,
    );
  }
}
