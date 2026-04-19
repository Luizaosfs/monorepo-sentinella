import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class CruzamentosDocaso {
  constructor(private prisma: PrismaService) {}

  execute(casoId: string, clienteId: string) {
    return this.prisma.client.$queryRaw(Prisma.sql`
      SELECT
        c.id,
        c.levantamento_item_id,
        c.distancia_metros,
        c.criado_em
      FROM caso_foco_cruzamento c
      INNER JOIN casos_notificados cn ON cn.id = c.caso_id
        AND cn.cliente_id = ${clienteId}::uuid
        AND cn.deleted_at IS NULL
      WHERE c.caso_id = ${casoId}::uuid
      ORDER BY c.distancia_metros ASC
    `);
  }
}
