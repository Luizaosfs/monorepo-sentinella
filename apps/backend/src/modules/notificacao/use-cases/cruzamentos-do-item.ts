import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class CruzamentosDoItem {
  constructor(private prisma: PrismaService) {}

  execute(itemId: string, clienteId: string) {
    return this.prisma.client.$queryRaw(Prisma.sql`
      SELECT
        c.id,
        c.distancia_metros,
        c.criado_em,
        json_build_object(
          'id',               cn.id,
          'doenca',           cn.doenca,
          'status',           cn.status,
          'data_notificacao', cn.data_notificacao,
          'logradouro_bairro', cn.logradouro_bairro,
          'bairro',           cn.bairro,
          'latitude',         cn.latitude,
          'longitude',        cn.longitude
        ) AS caso
      FROM caso_foco_cruzamento c
      INNER JOIN casos_notificados cn ON cn.id = c.caso_id
        AND cn.cliente_id = ${clienteId}::uuid
        AND cn.deleted_at IS NULL
      WHERE c.levantamento_item_id = ${itemId}::uuid
      ORDER BY c.distancia_metros ASC
    `);
  }
}
