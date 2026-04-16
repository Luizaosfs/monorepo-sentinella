import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

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
    const clienteId = (query.clienteId ?? this.req['tenantId']) as string;
    return this.readRepository.consumoLarvicida(clienteId, query.ciclo);
  }
}
