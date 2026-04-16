import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { OperacaoReadRepository } from '../repositories/operacao-read.repository';

@Injectable()
export class StatsOperacao {
  constructor(
    private repository: OperacaoReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute() {
    const clienteId = this.req['tenantId'] as string;
    const byStatus = await this.repository.countByStatus(clienteId);
    return { byStatus };
  }
}
