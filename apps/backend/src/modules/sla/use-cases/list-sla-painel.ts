import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { SlaReadRepository } from '../repositories/sla-read.repository';

@Injectable()
export class ListSlaPainel {
  constructor(
    private repository: SlaReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(operadorId?: string) {
    const clienteId = this.req['tenantId'] as string;
    const slas = await this.repository.findPainel(clienteId, operadorId);
    return { slas };
  }
}
