import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class RiscoByCliente {
  constructor(private prisma: PrismaService) {}

  execute(clienteId: string) {
    return this.prisma.client.$queryRaw(Prisma.sql`
      SELECT
        r.id           AS regiao_id,
        r.nome         AS regiao_nome,
        pr.nivel_risco,
        pr.chuva_24h,
        pr.run_id,
        pr.updated_at
      FROM regioes r
      LEFT JOIN LATERAL (
        SELECT nivel_risco, chuva_24h, run_id, updated_at
        FROM pluvio_risco
        WHERE regiao_id = r.id
        ORDER BY updated_at DESC
        LIMIT 1
      ) pr ON TRUE
      WHERE r.cliente_id = ${clienteId}::uuid
        AND r.deleted_at IS NULL
      ORDER BY r.nome
    `);
  }
}
