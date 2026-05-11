import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { Request } from 'express';
import { AuthenticatedUser } from 'src/guards/auth.guard';

import { Reinspecao } from '../entities/reinspecao';
import { ReinspecaoReadRepository } from '../repositories/reinspecao-read.repository';

@Injectable()
export class ListReinspecoesTerritorioUseCase {
  constructor(
    private repository: ReinspecaoReadRepository,
    private prisma: PrismaService,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(clienteId: string): Promise<Reinspecao[]> {
    const user = this.req['user'] as AuthenticatedUser;
    const isPrivileged =
      user.isPlatformAdmin ||
      user.papeis.some((p) => p === 'supervisor' || p === 'admin');

    if (isPrivileged) {
      return this.repository.findAll({ clienteId });
    }

    const quadraIds = await this.getTerritorioQuadraIds(clienteId, user.id);
    if (quadraIds.length === 0) return [];
    return this.repository.findAllTerritorio(clienteId, quadraIds);
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
