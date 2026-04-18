import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { FilterVistoriaInput } from '../dtos/filter-vistoria.input';
import { VistoriaReadRepository } from '../repositories/vistoria-read.repository';

@Injectable()
export class CountVistoria {
  constructor(
    private repository: VistoriaReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(filters: FilterVistoriaInput): Promise<{ count: number }> {
    const clienteId = this.req['tenantId'];
    const count = await this.repository.count({ ...filters, clienteId });
    return { count };
  }
}
