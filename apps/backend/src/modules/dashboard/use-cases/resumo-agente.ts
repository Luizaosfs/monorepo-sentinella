import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

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
    const clienteId = (query.clienteId ?? this.req['tenantId']) as string;
    return this.readRepository.resumoAgente(
      clienteId,
      query.agenteId,
      query.ciclo,
    );
  }
}
