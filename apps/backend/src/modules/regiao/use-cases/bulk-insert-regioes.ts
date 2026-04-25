import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { BulkInsertRegioesInput } from '../dtos/bulk-insert-regioes.body';

@Injectable()
export class BulkInsertRegioes {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string, input: BulkInsertRegioesInput): Promise<{ count: number }> {
    if (input.rows.length === 0) return { count: 0 };

    // Loop + $transaction: chosen over unnest because passing typed JSONB arrays as
    // Prisma bind params is unreliable across drivers. Per-row $executeRaw is clear
    // and safe up to the 500-row DTO limit.
    const ops = input.rows.map(r => {
      const geojsonStr = r.geojson ? JSON.stringify(r.geojson) : null;
      return this.prisma.client.$executeRaw(Prisma.sql`
        INSERT INTO regioes (
          cliente_id, nome, tipo, cor, geojson, area,
          latitude, longitude, municipio, uf, ativo
        )
        VALUES (
          ${clienteId}::uuid,
          ${r.nome},
          ${r.tipo ?? null}::text,
          ${r.cor ?? null}::text,
          ${geojsonStr}::jsonb,
          CASE WHEN ${geojsonStr} IS NOT NULL
            THEN ST_GeomFromGeoJSON(${geojsonStr})
            ELSE NULL
          END,
          ${r.latitude ?? null}::float8,
          ${r.longitude ?? null}::float8,
          ${r.municipio ?? null}::text,
          ${r.uf ?? null}::text,
          ${r.ativo ?? true}
        )
        ON CONFLICT DO NOTHING
      `);
    });

    const results = await this.prisma.client.$transaction(ops);
    return { count: results.reduce((sum, n) => sum + n, 0) };
  }
}
