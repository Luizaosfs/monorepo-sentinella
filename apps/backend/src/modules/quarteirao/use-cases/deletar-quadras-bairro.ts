import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';

import { QuarteiraoException } from '../errors/quarteirao.exception';
import { QuarteiraoReadRepository } from '../repositories/quarteirao-read.repository';
import { QuarteiraoWriteRepository } from '../repositories/quarteirao-write.repository';

@Injectable({ scope: Scope.REQUEST })
export class DeletarQuadrasBairro {
  constructor(
    private readRepository: QuarteiraoReadRepository,
    private writeRepository: QuarteiraoWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(bairroId: string) {
    const clienteId = requireTenantId(getAccessScope(this.req));

    const totalDistribuicoes = await this.readRepository.countDistribuicoesByBairroId(
      clienteId,
      bairroId,
    );

    if (totalDistribuicoes > 0) {
      throw QuarteiraoException.bairroComDistribuicoes();
    }

    return this.writeRepository.deletarQuadrasBairro(clienteId, bairroId);
  }
}
