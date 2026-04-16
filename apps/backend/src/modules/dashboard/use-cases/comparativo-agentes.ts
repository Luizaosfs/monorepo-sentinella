import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

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
    const clienteId = (query.clienteId ?? this.req['tenantId']) as string;
    return this.readRepository.comparativoAgentes(clienteId, query.ciclo);
  }
}
