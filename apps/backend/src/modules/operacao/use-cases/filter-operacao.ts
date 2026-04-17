import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { FilterOperacaoInput } from '../dtos/filter-operacao.input';
import { OperacaoReadRepository } from '../repositories/operacao-read.repository';

@Injectable()
export class FilterOperacao {
  constructor(
    private repository: OperacaoReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(filters: FilterOperacaoInput) {
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = this.req['tenantId'];
    const operacoes = await this.repository.findAll({ ...filters, clienteId });
    return { operacoes };
  }
}
