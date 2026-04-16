import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { ResumoRegionalQuery } from '../dtos/dashboard-analytics.input';
import {
  DashboardReadRepository,
  ResumoRegionalRow,
} from '../repositories/dashboard-read.repository';

@Injectable()
export class ResumoRegional {
  constructor(
    private readRepository: DashboardReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(query: ResumoRegionalQuery): Promise<ResumoRegionalRow[]> {
    const clienteId = (query.clienteId ?? this.req['tenantId']) as string;
    return this.readRepository.resumoRegional(
      clienteId,
      query.ciclo,
      query.de,
      query.ate,
    );
  }
}
