import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class ListCasoIdsComCruzamento {
  constructor(private prisma: PrismaService) {}

  async execute(casoIds: string[], clienteId: string): Promise<string[]> {
    if (casoIds.length === 0) return [];

    const rows = await this.prisma.client.$queryRaw<{ caso_id: string }[]>(Prisma.sql`
      SELECT DISTINCT c.caso_id::text
      FROM caso_foco_cruzamento c
      INNER JOIN casos_notificados cn ON cn.id = c.caso_id
        AND cn.cliente_id = ${clienteId}::uuid
        AND cn.deleted_at IS NULL
      WHERE c.caso_id = ANY(${casoIds}::uuid[])
    `);
    return rows.map(r => r.caso_id);
  }
}
