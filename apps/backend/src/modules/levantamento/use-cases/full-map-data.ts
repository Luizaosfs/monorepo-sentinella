import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

@Injectable()
export class FullMapData {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string) {
    const [itens, clienteRow, planejRows, regioesRows] = await Promise.all([
      this.prisma.client.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
        SELECT li.*,
          json_build_object('titulo', l.titulo, 'cliente_id', l.cliente_id) AS levantamento,
          (
            SELECT json_build_object('marca', d.marca, 'modelo', d.modelo)
            FROM drones d WHERE d.id = li.id_drone
          ) AS drone
        FROM levantamento_itens li
        INNER JOIN levantamentos l ON l.id = li.levantamento_id
          AND l.cliente_id = ${clienteId}::uuid
        WHERE li.latitude IS NOT NULL
          AND li.longitude IS NOT NULL
          AND li.deleted_at IS NULL
        ORDER BY li.data_hora DESC NULLS LAST
        LIMIT 2000
      `),

      this.prisma.client.clientes.findFirst({
        where:  { id: clienteId },
        select: { area: true },
      }),

      this.prisma.client.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
        SELECT id, descricao, ST_AsGeoJSON(area)::json AS area
        FROM planejamento
        WHERE cliente_id = ${clienteId}::uuid
          AND area IS NOT NULL
          AND deleted_at IS NULL
      `),

      this.prisma.client.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
        SELECT id, nome AS regiao, ST_AsGeoJSON(area)::json AS area
        FROM regioes
        WHERE cliente_id = ${clienteId}::uuid
          AND area IS NOT NULL
          AND deleted_at IS NULL
      `),
    ]);

    const regIds = (regioesRows as { id: string }[]).map(r => r.id);
    const pluvioRiscoMap: Record<string, unknown> = {};

    if (regIds.length > 0) {
      const pluvioRows = await this.prisma.client.$queryRaw<Record<string, unknown>[]>(Prisma.sql`
        SELECT DISTINCT ON (regiao_id) *
        FROM pluvio_risco
        WHERE regiao_id = ANY(${regIds}::uuid[])
        ORDER BY regiao_id, dt_ref DESC
      `);
      for (const p of pluvioRows) {
        const rid = p.regiao_id as string;
        if (!pluvioRiscoMap[rid]) pluvioRiscoMap[rid] = p;
      }
    }

    return {
      itens,
      clienteArea:    (clienteRow?.area ?? null) as Record<string, unknown> | null,
      planejamentos:  planejRows,
      regioes:        regioesRows,
      pluvioRiscoMap,
    };
  }
}
