import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { Request } from 'express';
import { getAccessScope } from '@shared/security/access-scope.helpers';
import { AuthenticatedUser } from 'src/guards/auth.guard';

import { FilterReinspecaoInput } from '../dtos/filter-reinspecao.input';
import { ReinspecaoException } from '../errors/reinspecao.exception';
import { ReinspecaoReadRepository } from '../repositories/reinspecao-read.repository';

@Injectable()
export class FilterReinspecoes {
  constructor(
    private repository: ReinspecaoReadRepository,
    private prisma: PrismaService,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(filters: FilterReinspecaoInput) {
    const isAdmin = this.req['user']?.isPlatformAdmin ?? false;
    if (
      filters.clienteId &&
      !isAdmin &&
      filters.clienteId !== getAccessScope(this.req).tenantId
    ) {
      throw ReinspecaoException.forbiddenTenant();
    }

    const clienteId = getAccessScope(this.req).tenantId;
    const merged: FilterReinspecaoInput = {
      ...filters,
      ...(clienteId != null && { clienteId }),
    };

    const user = this.req['user'] as AuthenticatedUser | undefined;
    const isPrivileged =
      isAdmin ||
      user?.papeis.some((p) => p === 'supervisor' || p === 'admin') === true;

    // Agente: filtro territorial (quadra_id via foco → imóvel)
    if (!isPrivileged && clienteId && user) {
      const quadraIds = await this.getTerritorioQuadraIds(clienteId, user.id);
      const items = await this.repository.findAllTerritorio(clienteId, quadraIds);
      return { reinspecoes: items };
    }

    const items = await this.repository.findAll(merged);
    return { reinspecoes: items };
  }

  private async getTerritorioQuadraIds(
    clienteId: string,
    agenteId: string,
  ): Promise<string[]> {
    const rows = await this.prisma.client.$queryRaw<{ quadra_id: string }[]>(
      Prisma.sql`
        SELECT DISTINCT bd.quadra_id::text AS quadra_id
        FROM bairros_distribuicao bd
        JOIN bairros_quadras bq ON bq.id = bd.quadra_id AND bq.deleted_at IS NULL
        WHERE bd.cliente_id = ${clienteId}::uuid
          AND bd.agente_id  = ${agenteId}::uuid
          AND bd.ciclo_id   IS NULL
      `,
    );
    return rows.map((r) => r.quadra_id);
  }
}
