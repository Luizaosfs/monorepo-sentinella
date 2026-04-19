import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class ListWithCliente {
  constructor(private prisma: PrismaService) {}

  execute(clienteId: string | null) {
    return this.prisma.client.$queryRaw(
      clienteId
        ? Prisma.sql`
            SELECT p.*,
              json_build_object(
                'id',               c.id,
                'nome',             c.nome,
                'latitude_centro',  c.latitude_centro,
                'longitude_centro', c.longitude_centro
              ) AS cliente
            FROM planejamento p
            INNER JOIN clientes c ON c.id = p.cliente_id
            WHERE p.deleted_at IS NULL
              AND p.cliente_id = ${clienteId}::uuid
            ORDER BY p.data_planejamento DESC NULLS LAST
          `
        : Prisma.sql`
            SELECT p.*,
              json_build_object(
                'id',               c.id,
                'nome',             c.nome,
                'latitude_centro',  c.latitude_centro,
                'longitude_centro', c.longitude_centro
              ) AS cliente
            FROM planejamento p
            INNER JOIN clientes c ON c.id = p.cliente_id
            WHERE p.deleted_at IS NULL
            ORDER BY p.data_planejamento DESC NULLS LAST
          `,
    );
  }
}
