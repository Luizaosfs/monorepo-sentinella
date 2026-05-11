import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { getAccessScope } from '@shared/security/access-scope.helpers';

import { QuarteiraoException } from '../errors/quarteirao.exception';
import { QuarteiraoReadRepository } from '../repositories/quarteirao-read.repository';

@Injectable({ scope: Scope.REQUEST })
export class ListarTerritorioAgente {
  constructor(
    private readRepository: QuarteiraoReadRepository,
    private prisma: PrismaService,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute() {
    const scope = getAccessScope(this.req);
    const clienteId = scope.tenantId;
    if (!clienteId) throw QuarteiraoException.badRequest();

    const agenteId = scope.userId;

    const [quadras, cicloRaw] = await Promise.all([
      this.readRepository.findTerritorioAgente(clienteId, agenteId),
      this.prisma.client.ciclos.findFirst({
        where: { cliente_id: clienteId, status: 'ativo' },
        select: {
          id: true,
          numero: true,
          status: true,
          data_inicio: true,
          data_fim_prevista: true,
        },
      }),
    ]);

    const cicloAtivo = cicloRaw
      ? {
          id:               cicloRaw.id,
          numero:           cicloRaw.numero,
          status:           cicloRaw.status,
          dataInicio:       cicloRaw.data_inicio.toISOString(),
          dataFimPrevista:  cicloRaw.data_fim_prevista.toISOString(),
        }
      : null;

    return { agenteId, quadras, cicloAtivo };
  }
}
