import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class ListItensPorPeriodo {
  constructor(private prisma: PrismaService) {}

  execute(clienteId: string, from: string, to: string) {
    return this.prisma.client.$queryRaw(Prisma.sql`
      SELECT
        li.id,
        li.latitude::float,
        li.longitude::float,
        li.item,
        li.risco,
        li.prioridade,
        li.endereco_curto,
        li.data_hora,
        li.levantamento_id
      FROM levantamento_itens li
      WHERE li.cliente_id = ${clienteId}::uuid
        AND li.latitude   IS NOT NULL
        AND li.longitude  IS NOT NULL
        AND li.deleted_at IS NULL
        AND li.data_hora  >= ${from}::timestamptz
        AND li.data_hora  <= ${to}::timestamptz
      ORDER BY li.data_hora DESC
    `);
  }
}
