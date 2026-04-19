import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class CountProximosAoItem {
  constructor(private prisma: PrismaService) {}

  async execute(itemId: string, clienteId: string): Promise<number> {
    const item = await this.prisma.client.levantamento_itens.findFirst({
      where: { id: itemId, cliente_id: clienteId, deleted_at: null },
      select: { latitude: true, longitude: true },
    });
    if (!item || item.latitude == null || item.longitude == null) return 0;

    const rows = await this.prisma.client.$queryRaw<[{ total: number }]>(Prisma.sql`
      SELECT COUNT(*)::int AS total
      FROM casos_notificados
      WHERE cliente_id = ${clienteId}::uuid
        AND deleted_at IS NULL
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL
        AND ST_DWithin(
          ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${item.longitude}, ${item.latitude}), 4326)::geography,
          300
        )
    `);
    return Number(rows[0]?.total ?? 0);
  }
}
