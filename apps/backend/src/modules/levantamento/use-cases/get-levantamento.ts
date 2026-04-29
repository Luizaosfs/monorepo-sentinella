import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope } from '@shared/security/access-scope.helpers';
import { LevantamentoException } from '../errors/levantamento.exception';
import { LevantamentoReadRepository } from '../repositories/levantamento-read.repository';

@Injectable()
export class GetLevantamento {
  constructor(
    private repository: LevantamentoReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string) {
    const tenantId = getAccessScope(this.req).tenantId;
    const levantamento = await this.repository.findByIdComItens(id, tenantId);
    if (!levantamento) throw LevantamentoException.notFound();
    return { levantamento };
  }
}
