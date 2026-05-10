import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import type { DesenharQuarteiraoInput } from '../dtos/desenhar-quarteirao.body';
import { QuarteiraoException } from '../errors/quarteirao.exception';

@Injectable()
export class DesenharQuarteirao {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string, input: DesenharQuarteiraoInput) {
    const geojsonStr = JSON.stringify(input.geojson);

    // 1. Região pertence ao cliente e existe
    const regioes = await this.prisma.client.$queryRaw<
      Array<{ id: string; has_area: boolean }>
    >(Prisma.sql`
      SELECT id::text,
             (area IS NOT NULL) AS has_area
        FROM bairros
       WHERE id          = ${input.bairroId}::uuid
         AND cliente_id  = ${clienteId}::uuid
         AND deleted_at IS NULL
    `);
    if (regioes.length === 0) throw QuarteiraoException.forbiddenTenant();
    const regiao = regioes[0];

    // 2. Polígono geometricamente válido (PostGIS ST_IsValid)
    const [validRow] = await this.prisma.client.$queryRaw<Array<{ valid: boolean }>>(Prisma.sql`
      SELECT ST_IsValid(ST_GeomFromGeoJSON(${geojsonStr})) AS valid
    `);
    if (!validRow.valid) throw QuarteiraoException.invalidGeom();

    // 3. Polígono contido na região (somente se a região tem geometria)
    if (regiao.has_area) {
      const [containsRow] = await this.prisma.client.$queryRaw<Array<{ within: boolean }>>(Prisma.sql`
        SELECT ST_Covers(r.area, ST_GeomFromGeoJSON(${geojsonStr})) AS within
          FROM bairros r
         WHERE r.id = ${input.bairroId}::uuid
      `);
      if (!containsRow.within) throw QuarteiraoException.geomOutsideRegiao();
    }

    // 4. Sem sobreposição com quarteirões existentes do mesmo cliente
    const [overlapRow] = await this.prisma.client.$queryRaw<Array<{ overlap: boolean }>>(Prisma.sql`
      SELECT EXISTS (
        SELECT 1 FROM bairros_quadras q
         WHERE q.cliente_id  = ${clienteId}::uuid
           AND q.deleted_at IS NULL
           AND q.area IS NOT NULL
           AND ST_Intersects(q.area, ST_GeomFromGeoJSON(${geojsonStr}))
      ) AS overlap
    `);
    if (overlapRow.overlap) throw QuarteiraoException.geomOverlap();

    // 5. Código único no cliente (belt-and-suspenders — @@unique também enforça)
    const dup = await this.prisma.client.bairros_quadras.findFirst({
      where: { cliente_id: clienteId, codigo: input.codigo, deleted_at: null },
      select: { id: true },
    });
    if (dup) throw QuarteiraoException.conflict();

    // 6. Cria registro + sincroniza geometria PostGIS em uma transação
    const result = await this.prisma.client.$transaction(async (tx) => {
      const row = await tx.bairros_quadras.create({
        data: {
          cliente_id: clienteId,
          bairro_id:  input.bairroId,
          codigo:     input.codigo,
          geojson:    input.geojson as unknown as Prisma.InputJsonValue,
          ativo:      true,
          ...(input.areaM2 != null ? { area_m2: input.areaM2 } : {}),
        },
      });
      // Sincroniza area (PostGIS) + centróide na mesma transação
      await tx.$executeRaw(Prisma.sql`
        UPDATE bairros_quadras
           SET area      = ST_GeomFromGeoJSON(geojson::text),
               latitude  = ST_Y(ST_Centroid(ST_GeomFromGeoJSON(geojson::text))),
               longitude = ST_X(ST_Centroid(ST_GeomFromGeoJSON(geojson::text)))
         WHERE id = ${row.id}::uuid
      `);
      return tx.bairros_quadras.findUnique({ where: { id: row.id } });
    });

    return result;
  }
}
