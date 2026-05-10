import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { BulkInsertRegioesInput } from '../dtos/bulk-insert-regioes.body';

@Injectable()
export class BulkInsertRegioes {
  constructor(private prisma: PrismaService) {}

  async execute(clienteId: string, input: BulkInsertRegioesInput): Promise<{ inserted: number; updated: number }> {
    if (input.rows.length === 0) return { inserted: 0, updated: 0 };

    const nomes = input.rows.map(r => r.nome);

    const existing = await this.prisma.client.bairros.findMany({
      where: { cliente_id: clienteId, nome: { in: nomes }, deleted_at: null },
      select: { id: true, nome: true },
    });

    const existingMap = new Map(existing.map(e => [e.nome, e.id]));

    const toInsert = input.rows.filter(r => !existingMap.has(r.nome));
    const toUpdate = input.rows.filter(r => existingMap.has(r.nome));

    let inserted = 0;
    let updated = 0;

    // Atualiza regiões existentes
    for (const r of toUpdate) {
      await this.prisma.client.bairros.update({
        where: { id: existingMap.get(r.nome)! },
        data: {
          latitude:  r.latitude  ?? null,
          longitude: r.longitude ?? null,
          ...(r.cor !== undefined ? { cor: r.cor } : {}),
        },
      });
      updated++;
    }

    // Insere novas sem geojson via createMany
    const novasNoGeo = toInsert.filter(r => !r.geojson);
    if (novasNoGeo.length > 0) {
      const result = await this.prisma.client.bairros.createMany({
        data: novasNoGeo.map(r => ({
          cliente_id: clienteId,
          nome:       r.nome,
          cor:        r.cor       ?? null,
          latitude:   r.latitude  ?? null,
          longitude:  r.longitude ?? null,
          ativo:      r.ativo     ?? true,
        })),
      });
      inserted += result.count;
    }

    // Insere novas com geojson via raw SQL (necessário para ST_GeomFromGeoJSON)
    for (const r of toInsert.filter(r => r.geojson)) {
      const geojsonStr = JSON.stringify(r.geojson);
      await this.prisma.client.$executeRaw(Prisma.sql`
        INSERT INTO bairros (cliente_id, nome, cor, geojson, area, latitude, longitude, ativo)
        VALUES (
          ${clienteId}::uuid, ${r.nome},
          ${r.cor ?? null}::text,
          ${geojsonStr}::jsonb, ST_GeomFromGeoJSON(${geojsonStr}),
          ${r.latitude  ?? null}::float8, ${r.longitude ?? null}::float8,
          ${r.ativo ?? true}
        )
      `);
      inserted++;
    }

    return { inserted, updated };
  }
}
