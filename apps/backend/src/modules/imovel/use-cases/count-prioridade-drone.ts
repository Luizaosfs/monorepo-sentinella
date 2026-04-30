import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';

import { PrismaService } from 'src/shared/modules/database/prisma/prisma.service';

@Injectable()
export class CountPrioridadeDrone {
  constructor(
    private prisma: PrismaService,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute() {
    const clienteId = requireTenantId(getAccessScope(this.req));

    return this.prisma.client.imoveis.count({
      where: { cliente_id: clienteId, prioridade_drone: true, deleted_at: null },
    });
  }
}
