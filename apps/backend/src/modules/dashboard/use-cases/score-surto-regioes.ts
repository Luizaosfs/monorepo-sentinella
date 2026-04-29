import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';

import { ScoreSurtoQuery } from '../dtos/dashboard-analytics.input';
import {
  DashboardReadRepository,
  ScoreSurtoRow,
} from '../repositories/dashboard-read.repository';

@Injectable()
export class ScoreSurtoRegioes {
  constructor(
    private readRepository: DashboardReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(query: ScoreSurtoQuery): Promise<ScoreSurtoRow[]> {
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = requireTenantId(getAccessScope(this.req));
    return this.readRepository.scoreSurtoRegioes(clienteId);
  }
}
