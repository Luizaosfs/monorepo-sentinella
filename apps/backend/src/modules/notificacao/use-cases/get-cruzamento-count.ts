import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class GetCruzamentoCount {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string): Promise<number> {
    const rows = await this.prisma.client.$queryRaw<[{ count: number }]>(Prisma.sql`
      SELECT COUNT(DISTINCT cfc.levantamento_item_id)::int AS count
      FROM caso_foco_cruzamento cfc
      INNER JOIN casos_notificados cn ON cn.id = cfc.caso_id
        AND cn.cliente_id = ${clienteId}::uuid
        AND cn.deleted_at IS NULL
      WHERE cfc.levantamento_item_id IS NOT NULL
    `);
    return Number(rows[0]?.count ?? 0);
  }
}
