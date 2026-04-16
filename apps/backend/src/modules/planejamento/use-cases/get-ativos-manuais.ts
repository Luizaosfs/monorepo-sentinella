import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { PlanejamentoReadRepository } from '../repositories/planejamento-read.repository';

@Injectable()
export class GetAtivosManuais {
  constructor(
    private repository: PlanejamentoReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute() {
    const clienteId = this.req['tenantId'] as string;
    const planejamentos = await this.repository.findAtivosManuais(clienteId);
    return { planejamentos };
  }
}
