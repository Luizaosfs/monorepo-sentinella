import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { assertTenantOwnership } from 'src/shared/security/tenant-ownership.util';

import { OperacaoException } from '../errors/operacao.exception';
import { OperacaoReadRepository } from '../repositories/operacao-read.repository';

@Injectable()
export class GetOperacao {
  constructor(
    private repository: OperacaoReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string) {
    const operacao = await this.repository.findByIdComEvidencias(id);
    if (!operacao) throw OperacaoException.notFound();
    assertTenantOwnership(operacao.clienteId, this.req);
    return { operacao };
  }
}
