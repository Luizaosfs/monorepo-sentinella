import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { Request } from 'express';
import { getAccessScope } from '@shared/security/access-scope.helpers';

import { CreateDistribuicaoBody } from '../dtos/create-distribuicao.body';
import { QuarteiraoException } from '../errors/quarteirao.exception';
import { DistribuicaoQuarteirao } from '../entities/quarteirao';
import { QuarteiraoWriteRepository } from '../repositories/quarteirao-write.repository';

@Injectable({ scope: Scope.REQUEST })
export class CreateDistribuicao {
  constructor(
    private repository: QuarteiraoWriteRepository,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(input: CreateDistribuicaoBody) {
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = getAccessScope(this.req).tenantId;
    if (!clienteId) {
      throw QuarteiraoException.badRequest();
    }

    const isAdmin = this.req['user']?.isPlatformAdmin ?? false;
    if (
      input.clienteId &&
      !isAdmin &&
      input.clienteId !== getAccessScope(this.req).tenantId
    ) {
      throw QuarteiraoException.forbiddenTenant();
    }

    const entity = new DistribuicaoQuarteirao(
      {
        clienteId,
        cicloId:  input.cicloId,
        quadraId: input.quadraId,
        agenteId: input.agenteId,
        bairroId: input.bairroId,
      },
      {},
    );

    try {
      const created = await this.repository.createDistribuicao(entity);
      return { distribuicao: created };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw QuarteiraoException.conflictDistribuicao();
      }
      throw e;
    }
  }
}
