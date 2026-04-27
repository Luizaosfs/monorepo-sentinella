import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { LevantamentoException } from '../errors/levantamento.exception';
import { LevantamentoReadRepository } from '../repositories/levantamento-read.repository';

@Injectable()
export class GetLevantamento {
  constructor(
    private repository: LevantamentoReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string) {
    const tenantId = (this.req['tenantId'] as string | undefined) ?? null;
    const levantamento = await this.repository.findByIdComItens(id, tenantId);
    if (!levantamento) throw LevantamentoException.notFound();
    return { levantamento };
  }
}
