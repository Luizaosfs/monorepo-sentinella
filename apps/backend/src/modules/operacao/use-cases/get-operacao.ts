import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { OperacaoException } from '../errors/operacao.exception';
import { OperacaoReadRepository } from '../repositories/operacao-read.repository';

@Injectable()
export class GetOperacao {
  constructor(
    private repository: OperacaoReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string) {
    const tenantId = (this.req['tenantId'] as string | undefined) ?? null;
    const operacao = await this.repository.findByIdComEvidencias(id, tenantId);
    if (!operacao) throw OperacaoException.notFound();
    return { operacao };
  }
}
