import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope } from '@shared/security/access-scope.helpers';
import { OperacaoException } from '../errors/operacao.exception';
import { OperacaoReadRepository } from '../repositories/operacao-read.repository';

@Injectable()
export class GetOperacao {
  constructor(
    private repository: OperacaoReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string) {
    const operacao = await this.repository.findByIdComEvidencias(id, getAccessScope(this.req).tenantId);
    if (!operacao) throw OperacaoException.notFound();
    return { operacao };
  }
}
