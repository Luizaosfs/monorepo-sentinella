import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { assertTenantOwnership } from 'src/shared/security/tenant-ownership.util';

import { QuarteiraoException } from '../errors/quarteirao.exception';
import { QuarteiraoReadRepository } from '../repositories/quarteirao-read.repository';
import { QuarteiraoWriteRepository } from '../repositories/quarteirao-write.repository';

@Injectable({ scope: Scope.REQUEST })
export class DeleteDistribuicao {
  constructor(
    private readRepository: QuarteiraoReadRepository,
    private writeRepository: QuarteiraoWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string) {
    const row = await this.readRepository.findDistribuicaoById(id);
    if (!row) {
      throw QuarteiraoException.distribuicaoNotFound();
    }

    assertTenantOwnership(row.clienteId, this.req, () =>
      QuarteiraoException.forbiddenTenant(),
    );

    await this.writeRepository.deleteDistribuicao(id);
    return { id };
  }
}
