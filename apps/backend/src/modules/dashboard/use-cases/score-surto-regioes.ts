import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

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
    const clienteId = (query.clienteId ?? this.req['tenantId']) as string;
    return this.readRepository.scoreSurtoRegioes(clienteId);
  }
}
