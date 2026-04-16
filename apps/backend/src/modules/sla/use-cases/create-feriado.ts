import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { CreateFeriadoBody } from '../dtos/create-feriado.body';
import { SlaWriteRepository } from '../repositories/sla-write.repository';

@Injectable()
export class CreateFeriado {
  constructor(
    private repository: SlaWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(data: CreateFeriadoBody) {
    const clienteId = this.req['tenantId'] as string;
    const feriado = await this.repository.createFeriado({
      clienteId,
      data: data.data,
      descricao: data.descricao,
      nacional: data.nacional ?? false,
    });
    return { feriado };
  }
}
