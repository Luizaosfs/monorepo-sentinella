import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { SlaReadRepository } from '../repositories/sla-read.repository';

@Injectable()
export class ListFeriados {
  constructor(
    private repository: SlaReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute() {
    const clienteId = this.req['tenantId'] as string;
    const feriados = await this.repository.findFeriados(clienteId);
    return { feriados };
  }
}
