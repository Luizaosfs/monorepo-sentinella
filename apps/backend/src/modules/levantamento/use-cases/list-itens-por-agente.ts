import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class ListItensPorAgente {
  constructor(private prisma: PrismaService) {}

  execute(usuarioId: string) {
    return this.prisma.client.$queryRaw(Prisma.sql`
      SELECT
        li.id,
        li.item,
        li.risco,
        li.prioridade,
        li.latitude,
        li.longitude,
        li.endereco_curto,
        li.data_hora,
        li.levantamento_id,
        li.cliente_id,
        o.id      AS operacao_id,
        o.status  AS operacao_status
      FROM levantamento_itens li
      INNER JOIN operacoes o ON o.item_levantamento_id = li.id
      WHERE o.responsavel_id = ${usuarioId}::uuid
        AND li.deleted_at IS NULL
        AND o.deleted_at  IS NULL
      ORDER BY li.data_hora DESC NULLS LAST
      LIMIT 200
    `);
  }
}
