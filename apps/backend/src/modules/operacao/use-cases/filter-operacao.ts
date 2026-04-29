import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

import { getAccessScope, getClienteIdsPermitidos } from '@shared/security/access-scope.helpers';
import { FilterOperacaoInput } from '../dtos/filter-operacao.input';
import { OperacaoReadRepository } from '../repositories/operacao-read.repository';

@Injectable()
export class FilterOperacao {
  constructor(
    private repository: OperacaoReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(filters: FilterOperacaoInput) {
    const clienteIds = getClienteIdsPermitidos(getAccessScope(this.req));
    const clienteId = clienteIds !== null ? clienteIds[0] : undefined;
    const operacoes = await this.repository.findAll({ ...filters, clienteId });
    return { operacoes };
  }
}
