import { DistribuicaoQuarteirao, Quarteirao } from '@modules/quarteirao/entities/quarteirao';
import { QuarteiraoWriteRepository } from '@modules/quarteirao/repositories/quarteirao-write.repository';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaQuarteiraoMapper } from '../../mappers/prisma-quarteirao.mapper';
import { PrismaService } from '../../prisma.service';

@PrismaRepository(QuarteiraoWriteRepository)
@Injectable()
export class PrismaQuarteiraoWriteRepository implements QuarteiraoWriteRepository {
  constructor(private prisma: PrismaService) {}

  async createQuarteirao(entity: Quarteirao): Promise<Quarteirao> {
    const data = {
      cliente_id: entity.clienteId,
      regiao_id: entity.regiaoId || null,
      codigo: entity.codigo,
      bairro: entity.bairro || null,
      ativo: entity.ativo,
    };
    const created = await this.prisma.client.quarteiroes.create({ data });
    return PrismaQuarteiraoMapper.quarteiraoToDomain(created as any);
  }

  async softDeleteQuarteirao(id: string, deletedBy?: string): Promise<void> {
    await this.prisma.client.quarteiroes.update({
      where: { id },
      data: {
        deleted_at: new Date(),
        deleted_by: deletedBy ?? null,
        updated_at: new Date(),
      },
    });
  }

  async createDistribuicao(
    entity: DistribuicaoQuarteirao,
  ): Promise<DistribuicaoQuarteirao> {
    const data = {
      cliente_id: entity.clienteId,
      ciclo: entity.ciclo,
      quarteirao: entity.quarteirao,
      agente_id: entity.agenteId,
      regiao_id: entity.regiaoId || null,
    };
    const created = await this.prisma.client.distribuicao_quarteirao.create({
      data,
    });
    return PrismaQuarteiraoMapper.distribuicaoToDomain(created as any);
  }

  async deleteDistribuicao(id: string): Promise<void> {
    await this.prisma.client.distribuicao_quarteirao.delete({ where: { id } });
  }

  async copiarDistribuicoesCiclo(input: {
    clienteId: string;
    cicloOrigem: number;
    cicloDestino: number;
  }): Promise<{ copiadas: number }> {
    const origens = await this.prisma.client.distribuicao_quarteirao.findMany({
      where: {
        cliente_id: input.clienteId,
        ciclo: input.cicloOrigem,
      },
    });

    let copiadas = 0;
    await this.prisma.client.$transaction(async (tx) => {
      for (const row of origens) {
        await tx.distribuicao_quarteirao.upsert({
          where: {
            cliente_id_ciclo_quarteirao: {
              cliente_id: input.clienteId,
              ciclo: input.cicloDestino,
              quarteirao: row.quarteirao,
            },
          },
          create: {
            cliente_id: input.clienteId,
            ciclo: input.cicloDestino,
            quarteirao: row.quarteirao,
            agente_id: row.agente_id,
            regiao_id: row.regiao_id,
          },
          update: {
            agente_id: row.agente_id,
            regiao_id: row.regiao_id,
            updated_at: new Date(),
          },
        });
        copiadas += 1;
      }
    });

    return { copiadas };
  }

  async upsertMestreIfMissing(
    clienteId: string,
    bairro: string | null | undefined,
    codigo: string,
  ): Promise<void> {
    const exists = await this.prisma.client.quarteiroes.findFirst({
      where: { cliente_id: clienteId, codigo, deleted_at: null },
      select: { id: true },
    });
    if (!exists) {
      await this.prisma.client.quarteiroes.create({
        data: { cliente_id: clienteId, codigo, bairro: bairro ?? null, ativo: true },
      });
    }
  }

  async saveQuarteirao(entity: Quarteirao): Promise<Quarteirao> {
    const geojsonIsNull = entity.geojson == null;
    await this.prisma.client.quarteiroes.updateMany({
      where: { id: entity.id, cliente_id: entity.clienteId, deleted_at: null },
      data: {
        codigo:     entity.codigo,
        regiao_id:  entity.regiaoId ?? null,
        ativo:      entity.ativo,
        geojson:    geojsonIsNull
          ? Prisma.JsonNull
          : (entity.geojson as Prisma.InputJsonValue),
        updated_at: new Date(),
      },
    });
    if (geojsonIsNull) {
      // Limpa campos PostGIS quando geojson é removido
      await this.prisma.client.$executeRaw(Prisma.sql`
        UPDATE quarteiroes
           SET area = NULL, latitude = NULL, longitude = NULL
         WHERE id = ${entity.id!}::uuid
      `);
    } else {
      await this.syncArea(entity.id!);
    }
    const fresh = await this.prisma.client.quarteiroes.findUnique({
      where: { id: entity.id! },
    });
    return PrismaQuarteiraoMapper.quarteiraoToDomain(fresh as any);
  }

  private async syncArea(id: string): Promise<void> {
    await this.prisma.client.$executeRaw(Prisma.sql`
      UPDATE quarteiroes
         SET area      = ST_GeomFromGeoJSON(geojson::text),
             latitude  = ST_Y(ST_Centroid(ST_GeomFromGeoJSON(geojson::text))),
             longitude = ST_X(ST_Centroid(ST_GeomFromGeoJSON(geojson::text)))
       WHERE id = ${id}::uuid
         AND geojson IS NOT NULL
         AND jsonb_typeof(geojson) = 'object'
         AND (geojson->>'type') = 'Polygon'
    `);
  }
}
