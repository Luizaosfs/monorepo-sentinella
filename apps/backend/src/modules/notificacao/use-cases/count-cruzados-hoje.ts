import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class CountCruzadosHoje {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string): Promise<number> {
    const rows = await this.prisma.client.$queryRaw<[{ total: number }]>(Prisma.sql`
      SELECT COUNT(DISTINCT c.caso_id)::int AS total
      FROM caso_foco_cruzamento c
      INNER JOIN casos_notificados cn ON cn.id = c.caso_id
        AND cn.cliente_id = ${clienteId}::uuid
        AND cn.deleted_at IS NULL
      WHERE c.criado_em >= CURRENT_DATE::timestamptz
    `);
    return Number(rows[0]?.total ?? 0);
  }
}
