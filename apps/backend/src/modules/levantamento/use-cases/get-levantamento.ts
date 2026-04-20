import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { assertTenantOwnership } from 'src/shared/security/tenant-ownership.util';

import { LevantamentoException } from '../errors/levantamento.exception';
import { LevantamentoReadRepository } from '../repositories/levantamento-read.repository';

@Injectable()
export class GetLevantamento {
  constructor(
    private repository: LevantamentoReadRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string) {
    const levantamento = await this.repository.findByIdComItens(id);
    if (!levantamento) throw LevantamentoException.notFound();
    assertTenantOwnership(levantamento.clienteId, this.req);
    return { levantamento };
  }
}
