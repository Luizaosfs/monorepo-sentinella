import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { OperacaoException } from '../errors/operacao.exception';
import { OperacaoReadRepository } from '../repositories/operacao-read.repository';
import { OperacaoWriteRepository } from '../repositories/operacao-write.repository';

@Injectable()
export class ResolverOperacao {
  constructor(
    private readRepository: OperacaoReadRepository,
    private writeRepository: OperacaoWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string) {
    const tenantId = (this.req['tenantId'] as string | undefined) ?? null;
    const operacao = await this.readRepository.findById(id, tenantId);
    if (!operacao) throw OperacaoException.notFound();

    operacao.status = 'concluido';
    operacao.concluidoEm = new Date();

    await this.writeRepository.save(operacao);
    return { operacao };
  }
}
