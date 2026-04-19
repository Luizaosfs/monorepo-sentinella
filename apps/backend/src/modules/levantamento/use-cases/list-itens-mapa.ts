import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class ListItensMapa {
  constructor(private prisma: PrismaService) {}

  execute(clienteId: string) {
    return this.prisma.client.$queryRaw(Prisma.sql`
      SELECT
        li.id,
        li.latitude,
        li.longitude,
        li.item,
        li.risco,
        li.prioridade,
        li.endereco_curto,
        li.data_hora,
        li.levantamento_id
      FROM levantamento_itens li
      INNER JOIN levantamentos lev ON lev.id = li.levantamento_id
      WHERE li.cliente_id = ${clienteId}::uuid
        AND li.latitude   IS NOT NULL
        AND li.longitude  IS NOT NULL
        AND li.deleted_at IS NULL
      ORDER BY li.created_at DESC
      LIMIT 500
    `);
  }
}
