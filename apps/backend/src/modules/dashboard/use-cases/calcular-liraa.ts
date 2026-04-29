import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';

import { LiraaQuery } from '../dtos/dashboard-analytics.input';
import {
  DashboardReadRepository,
  LiraaResult,
} from '../repositories/dashboard-read.repository';

@Injectable()
export class CalcularLiraa {
  constructor(
    private readRepository: DashboardReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(query: LiraaQuery): Promise<LiraaResult> {
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = requireTenantId(getAccessScope(this.req));
    return this.readRepository.calcularLiraa(clienteId, query.ciclo);
  }
}
