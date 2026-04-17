import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request } from 'express';

import { CreateDistribuicaoBody } from '../dtos/create-distribuicao.body';
import { QuarteiraoException } from '../errors/quarteirao.exception';
import { DistribuicaoQuarteirao } from '../entities/quarteirao';
import { QuarteiraoWriteRepository } from '../repositories/quarteirao-write.repository';

@Injectable()
export class CreateDistribuicao {
  constructor(
    private repository: QuarteiraoWriteRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(input: CreateDistribuicaoBody) {
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = this.req['tenantId'];
    if (!clienteId) {
      throw QuarteiraoException.badRequest();
    }

    const isAdmin = this.req['user']?.papeis?.includes('admin');
    if (
      input.clienteId &&
      !isAdmin &&
      input.clienteId !== this.req['tenantId']
    ) {
      throw QuarteiraoException.forbiddenTenant();
    }

    const entity = new DistribuicaoQuarteirao(
      {
        clienteId,
        ciclo: input.ciclo,
        quarteirao: input.quarteirao,
        agenteId: input.agenteId,
        regiaoId: input.regiaoId,
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
