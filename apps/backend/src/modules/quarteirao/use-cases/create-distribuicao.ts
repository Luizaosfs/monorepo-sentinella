import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { getAccessScope } from '@shared/security/access-scope.helpers';

import { CreateDistribuicaoBody } from '../dtos/create-distribuicao.body';
import { QuarteiraoException } from '../errors/quarteirao.exception';
import { DistribuicaoQuarteirao } from '../entities/quarteirao';
import { QuarteiraoWriteRepository } from '../repositories/quarteirao-write.repository';
import { EnsureCicloEditavel } from './ensure-ciclo-editavel';

@Injectable({ scope: Scope.REQUEST })
export class CreateDistribuicao {
  constructor(
    private repository: QuarteiraoWriteRepository,
    private prisma: PrismaService,
    private ensureCicloEditavel: EnsureCicloEditavel,
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

    await this.ensureCicloEditavel.execute(input.cicloId, clienteId);

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

      // History — best-effort
      const usuarioId = (this.req['user'] as { id: string } | undefined)?.id ?? null;
      void this.prisma.client.$executeRaw(Prisma.sql`
        INSERT INTO bairros_distribuicao_historico (cliente_id, ciclo_id, quadra_id, agente_id, acao, usuario_id)
        VALUES (${clienteId}::uuid, ${input.cicloId}::uuid, ${input.quadraId}::uuid, ${input.agenteId}::uuid, 'criada', ${usuarioId}::uuid)
      `).catch(() => undefined);

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
