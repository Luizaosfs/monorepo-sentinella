import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request } from 'express';

import { CreateQuarteiraoBody } from '../dtos/create-quarteirao.body';
import { QuarteiraoException } from '../errors/quarteirao.exception';
import { Quarteirao } from '../entities/quarteirao';
import { QuarteiraoWriteRepository } from '../repositories/quarteirao-write.repository';

@Injectable()
export class CreateQuarteirao {
  constructor(
    private repository: QuarteiraoWriteRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(input: CreateQuarteiraoBody) {
    // MT-02: tenantId do guard sempre vence — nunca aceita clienteId do frontend
    const clienteId = this.req['tenantId'];
    if (!clienteId) {
      throw QuarteiraoException.badRequest();
    }

    const isAdmin = this.req['user']?.isPlatformAdmin ?? false;
    if (
      input.clienteId &&
      !isAdmin &&
      input.clienteId !== this.req['tenantId']
    ) {
      throw QuarteiraoException.forbiddenTenant();
    }

    const entity = new Quarteirao(
      {
        clienteId,
        regiaoId: input.regiaoId,
        codigo: input.codigo,
        bairro: input.bairro,
        ativo: input.ativo ?? true,
      },
      { createdBy: this.req['user']?.id },
    );

    try {
      const created = await this.repository.createQuarteirao(entity);
      return { quarteirao: created };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw QuarteiraoException.conflict();
      }
      throw e;
    }
  }
}
