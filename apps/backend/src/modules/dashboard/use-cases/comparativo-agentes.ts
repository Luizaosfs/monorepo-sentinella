import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';

import { ComparativoAgentesQuery } from '../dtos/dashboard-analytics.input';
import {
  AgenteStat,
  DashboardReadRepository,
} from '../repositories/dashboard-read.repository';

@Injectable()
export class ComparativoAgentes {
  constructor(
    private readRepository: DashboardReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(query: ComparativoAgentesQuery): Promise<AgenteStat[]> {
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = requireTenantId(getAccessScope(this.req));
    return this.readRepository.comparativoAgentes(clienteId, query.ciclo);
  }
}
