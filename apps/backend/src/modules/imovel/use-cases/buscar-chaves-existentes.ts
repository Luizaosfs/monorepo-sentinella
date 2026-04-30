import { Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';

import { PrismaService } from 'src/shared/modules/database/prisma/prisma.service';

@Injectable()
export class BuscarChavesExistentes {
  constructor(
    private prisma: PrismaService,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute() {
    const clienteId = requireTenantId(getAccessScope(this.req));

    const registros = await this.prisma.client.imoveis.findMany({
      where: { cliente_id: clienteId, ativo: true, deleted_at: null },
      select: { logradouro: true, numero: true, bairro: true },
    });

    return registros.map(
      (r) =>
        `${(r.logradouro ?? '').toLowerCase().trim()}|${(r.numero ?? '').toLowerCase().trim()}|${(r.bairro ?? '').toLowerCase().trim()}`,
    );
  }
}
