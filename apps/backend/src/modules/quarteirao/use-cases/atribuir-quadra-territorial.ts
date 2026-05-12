import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { getAccessScope } from '@shared/security/access-scope.helpers';

import { QuarteiraoException } from '../errors/quarteirao.exception';
import { QuarteiraoWriteRepository } from '../repositories/quarteirao-write.repository';

@Injectable({ scope: Scope.REQUEST })
export class AtribuirQuadraTerritorial {
  constructor(
    private repository: QuarteiraoWriteRepository,
    private prisma: PrismaService,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(input: { quadraId: string; agenteId: string }) {
    const clienteId = getAccessScope(this.req).tenantId;
    if (!clienteId) throw QuarteiraoException.badRequest();

    const quadra = await this.prisma.client.bairros_quadras.findFirst({
      where: { id: input.quadraId, cliente_id: clienteId, deleted_at: null },
      select: { id: true, bairro_id: true },
    });
    if (!quadra) throw QuarteiraoException.notFound();

    const agente = await this.prisma.client.usuarios.findFirst({
      where: { id: input.agenteId, cliente_id: clienteId, ativo: true },
      select: { id: true },
    });
    if (!agente) throw QuarteiraoException.agenteNotFound();

    const distribuicao = await this.repository.atribuirQuadraTerritorial({
      clienteId,
      quadraId: input.quadraId,
      agenteId: input.agenteId,
      bairroId: quadra.bairro_id ?? undefined,
    });

    return { distribuicao };
  }
}
