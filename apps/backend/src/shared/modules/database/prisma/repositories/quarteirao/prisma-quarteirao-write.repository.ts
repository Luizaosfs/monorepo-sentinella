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
      bairro_id: entity.bairroId || null,
      codigo: entity.codigo,
      bairro: entity.bairro || null,
      ativo: entity.ativo,
    };
    const created = await this.prisma.client.bairros_quadras.create({ data });
    return PrismaQuarteiraoMapper.quarteiraoToDomain(created as any);
  }

  async softDeleteQuarteirao(id: string, deletedBy?: string): Promise<void> {
    await this.prisma.client.bairros_quadras.update({
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
      ciclo_id:   entity.cicloId,
      quadra_id:  entity.quadraId,
      agente_id:  entity.agenteId,
      bairro_id:  entity.bairroId || null,
    };
    const created = await this.prisma.client.bairros_distribuicao.create({
      data,
    });
    return PrismaQuarteiraoMapper.distribuicaoToDomain(created as any);
  }

  async deleteDistribuicao(id: string): Promise<void> {
    await this.prisma.client.bairros_distribuicao.delete({ where: { id } });
  }

  async copiarDistribuicoesCiclo(input: {
    clienteId: string;
    cicloOrigemId: string;
    cicloDestinoId: string;
  }): Promise<{ copiadas: number }> {
    const origens = await this.prisma.client.bairros_distribuicao.findMany({
      where: {
        cliente_id: input.clienteId,
        ciclo_id:   input.cicloOrigemId,
      },
    });

    let copiadas = 0;
    await this.prisma.client.$transaction(async (tx) => {
      for (const row of origens) {
        await tx.bairros_distribuicao.upsert({
          where: {
            cliente_id_ciclo_id_quadra_id: {
              cliente_id: input.clienteId,
              ciclo_id:   input.cicloDestinoId,
              quadra_id:  row.quadra_id,
            },
          },
          create: {
            cliente_id: input.clienteId,
            ciclo_id:   input.cicloDestinoId,
            quadra_id:  row.quadra_id,
            agente_id:  row.agente_id,
            bairro_id:  row.bairro_id,
          },
          update: {
            agente_id:  row.agente_id,
            bairro_id:  row.bairro_id,
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
    bairroId?: string | null,
  ): Promise<string> {
    const exists = await this.prisma.client.bairros_quadras.findFirst({
      where: {
        cliente_id: clienteId,
        codigo,
        bairro_id: bairroId ?? null,
        deleted_at: null,
      },
      select: { id: true },
    });
    if (exists) return exists.id;
    const created = await this.prisma.client.bairros_quadras.create({
      data: {
        cliente_id: clienteId,
        codigo,
        bairro: bairro ?? null,
        bairro_id: bairroId ?? null,
        ativo: true,
      },
      select: { id: true },
    });
    return created.id;
  }

  async atribuirQuadraTerritorial(input: {
    clienteId: string;
    quadraId: string;
    agenteId: string;
    bairroId?: string;
  }): Promise<DistribuicaoQuarteirao> {
    const { clienteId, quadraId, agenteId, bairroId } = input;
    const bairroSql = bairroId
      ? Prisma.sql`${bairroId}::uuid`
      : Prisma.sql`NULL`;

    const [row] = await this.prisma.client.$queryRaw<any[]>(Prisma.sql`
      INSERT INTO bairros_distribuicao (cliente_id, ciclo_id, quadra_id, agente_id, bairro_id)
      VALUES (
        ${clienteId}::uuid,
        NULL,
        ${quadraId}::uuid,
        ${agenteId}::uuid,
        ${bairroSql}
      )
      ON CONFLICT (cliente_id, quadra_id) WHERE ciclo_id IS NULL
      DO UPDATE SET
        agente_id  = EXCLUDED.agente_id,
        bairro_id  = EXCLUDED.bairro_id,
        updated_at = NOW()
      RETURNING id, cliente_id, ciclo_id, quadra_id, agente_id, bairro_id, created_at, updated_at
    `);

    return PrismaQuarteiraoMapper.distribuicaoToDomain(row);
  }

  async desatribuirQuadraTerritorial(input: {
    clienteId: string;
    quadraId: string;
  }): Promise<{ removida: boolean }> {
    const count = await this.prisma.client.$executeRaw(Prisma.sql`
      DELETE FROM bairros_distribuicao
      WHERE cliente_id = ${input.clienteId}::uuid
        AND quadra_id  = ${input.quadraId}::uuid
        AND ciclo_id IS NULL
    `);
    return { removida: count > 0 };
  }

  async findDistribuicaoTerritorialAtualByQuadra(
    clienteId: string,
    quadraId: string,
  ): Promise<DistribuicaoQuarteirao | null> {
    const raw = await this.prisma.client.bairros_distribuicao.findFirst({
      where: { cliente_id: clienteId, quadra_id: quadraId, ciclo_id: null },
    });
    return raw ? PrismaQuarteiraoMapper.distribuicaoToDomain(raw as any) : null;
  }

  async saveQuarteirao(entity: Quarteirao): Promise<Quarteirao> {
    const geojsonIsNull = entity.geojson == null;
    await this.prisma.client.bairros_quadras.updateMany({
      where: { id: entity.id, cliente_id: entity.clienteId, deleted_at: null },
      data: {
        codigo:     entity.codigo,
        bairro_id:  entity.bairroId ?? null,
        ativo:      entity.ativo,
        geojson:    geojsonIsNull
          ? Prisma.JsonNull
          : (entity.geojson as Prisma.InputJsonValue),
        updated_at: new Date(),
      },
    });
    if (geojsonIsNull) {
      await this.prisma.client.$executeRaw(Prisma.sql`
        UPDATE bairros_quadras
           SET area = NULL, latitude = NULL, longitude = NULL
         WHERE id = ${entity.id!}::uuid
      `);
    } else {
      await this.syncArea(entity.id!);
    }
    const fresh = await this.prisma.client.bairros_quadras.findUnique({
      where: { id: entity.id! },
    });
    return PrismaQuarteiraoMapper.quarteiraoToDomain(fresh as any);
  }

  async deletarQuadrasBairro(clienteId: string, bairroId: string): Promise<{ deletadas: number }> {
    const deleted = await this.prisma.client.$executeRaw(Prisma.sql`
      DELETE FROM bairros_quadras
      WHERE bairro_id  = ${bairroId}::uuid
        AND cliente_id = ${clienteId}::uuid
    `);
    return { deletadas: deleted };
  }

  private async syncArea(id: string): Promise<void> {
    await this.prisma.client.$executeRaw(Prisma.sql`
      UPDATE bairros_quadras
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
