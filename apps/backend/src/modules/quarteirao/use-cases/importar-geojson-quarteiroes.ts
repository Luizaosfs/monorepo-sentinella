import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import type { ImportarGeoJSONInput } from '../dtos/importar-geojson-quarteiroes.body';
import { DesenharQuarteirao } from './desenhar-quarteirao';

type GeoJSONPolygon = { type: 'Polygon'; coordinates: number[][][] };

@Injectable()
export class ImportarGeoJSONQuarteiroes {
  constructor(
    private prisma: PrismaService,
    private desenharUc: DesenharQuarteirao,
  ) {}

  async execute(clienteId: string, input: ImportarGeoJSONInput) {
    // Carrega regiões do cliente para resolução por nome e por PostGIS
    const regioes = await this.prisma.client.$queryRaw<
      Array<{ id: string; nome: string }>
    >(Prisma.sql`
      SELECT id::text, nome
        FROM regioes
       WHERE cliente_id = ${clienteId}::uuid
         AND deleted_at IS NULL
    `);

    const regiaoByNome = new Map(
      regioes.map((r) => [r.nome.toLowerCase().trim(), r.id]),
    );

    const criados: string[] = [];
    const erros: Array<{ codigo: string; motivo: string }> = [];
    const resultados: Array<{
      codigo: string;
      regiaoId: string | null;
      regiaoNome: string | null;
    }> = [];

    for (const feature of input.features) {
      try {
        const regiaoId = await this.resolveRegiaoId(
          clienteId,
          feature,
          regiaoByNome,
        );

        if (regiaoId) {
          await this.desenharUc.execute(clienteId, {
            regiaoId,
            codigo: feature.codigo,
            geojson: feature.geojson,
            areaM2: feature.areaM2,
          });
        } else {
          await this.criarSemRegiao(clienteId, feature);
        }

        criados.push(feature.codigo);
        resultados.push({
          codigo: feature.codigo,
          regiaoId,
          regiaoNome: regiaoId
            ? (regioes.find((r) => r.id === regiaoId)?.nome ?? null)
            : null,
        });
      } catch (err: unknown) {
        erros.push({
          codigo: feature.codigo,
          motivo: (err as { message?: string })?.message ?? 'Erro desconhecido',
        });
      }
    }

    return { ok: criados.length, criados, resultados, erros };
  }

  private async resolveRegiaoId(
    clienteId: string,
    feature: { regiaoId?: string; bairro?: string; geojson: GeoJSONPolygon },
    regiaoByNome: Map<string, string>,
  ): Promise<string | null> {
    // 1. UUID explícito nas propriedades
    if (feature.regiaoId) return feature.regiaoId;

    // 2. Nome do bairro → lookup
    if (feature.bairro) {
      const byName = regiaoByNome.get(feature.bairro.toLowerCase().trim());
      if (byName) return byName;
    }

    // 3. PostGIS ST_Contains — detecta automaticamente qual região contém o polígono
    const geojsonStr = JSON.stringify(feature.geojson);
    const rows = await this.prisma.client.$queryRaw<Array<{ regiao_id: string }>>(Prisma.sql`
      SELECT r.id::text AS regiao_id
        FROM regioes r
       WHERE r.cliente_id = ${clienteId}::uuid
         AND r.deleted_at IS NULL
         AND r.area IS NOT NULL
         AND ST_Contains(r.area, ST_GeomFromGeoJSON(${geojsonStr}))
       LIMIT 1
    `);
    return rows[0]?.regiao_id ?? null;
  }

  private async criarSemRegiao(
    clienteId: string,
    feature: { codigo: string; geojson: GeoJSONPolygon; areaM2?: number },
  ) {
    const geojsonStr = JSON.stringify(feature.geojson);

    const [validRow] = await this.prisma.client.$queryRaw<Array<{ valid: boolean }>>(Prisma.sql`
      SELECT ST_IsValid(ST_GeomFromGeoJSON(${geojsonStr})) AS valid
    `);
    if (!validRow.valid) throw new Error('Polígono geometricamente inválido');

    const [overlapRow] = await this.prisma.client.$queryRaw<Array<{ overlap: boolean }>>(Prisma.sql`
      SELECT EXISTS (
        SELECT 1 FROM quarteiroes q
         WHERE q.cliente_id = ${clienteId}::uuid
           AND q.deleted_at IS NULL
           AND q.area IS NOT NULL
           AND ST_Intersects(q.area, ST_GeomFromGeoJSON(${geojsonStr}))
      ) AS overlap
    `);
    if (overlapRow.overlap) throw new Error('Sobreposição com quarteirão existente');

    const dup = await this.prisma.client.quarteiroes.findFirst({
      where: { cliente_id: clienteId, codigo: feature.codigo, deleted_at: null },
      select: { id: true },
    });
    if (dup) throw new Error(`Código ${feature.codigo} já existe`);

    await this.prisma.client.$transaction(async (tx) => {
      const row = await tx.quarteiroes.create({
        data: {
          cliente_id: clienteId,
          regiao_id:  null,
          codigo:     feature.codigo,
          geojson:    feature.geojson as unknown as Prisma.InputJsonValue,
          ativo:      true,
          ...(feature.areaM2 != null ? { area_m2: feature.areaM2 } : {}),
        },
      });
      await tx.$executeRaw(Prisma.sql`
        UPDATE quarteiroes
           SET area      = ST_GeomFromGeoJSON(geojson::text),
               latitude  = ST_Y(ST_Centroid(ST_GeomFromGeoJSON(geojson::text))),
               longitude = ST_X(ST_Centroid(ST_GeomFromGeoJSON(geojson::text)))
         WHERE id = ${row.id}::uuid
      `);
    });
  }
}
