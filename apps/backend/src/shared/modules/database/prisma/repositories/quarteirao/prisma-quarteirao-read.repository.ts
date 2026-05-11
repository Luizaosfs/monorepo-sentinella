import { FilterDistribuicaoInput } from '@modules/quarteirao/dtos/filter-distribuicao.input';
import { FilterQuarteiraoInput } from '@modules/quarteirao/dtos/filter-quarteirao.input';
import {
  CoberturaCicloResult,
  CoberturaQuarteiraoItem,
  DistribuicaoTerritorialItem,
  QuarteiraoReadRepository,
} from '@modules/quarteirao/repositories/quarteirao-read.repository';
import { Prisma } from '@prisma/client';
import { DistribuicaoQuarteirao, Quarteirao } from '@modules/quarteirao/entities/quarteirao';
import { Injectable } from '@nestjs/common';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaQuarteiraoMapper } from '../../mappers/prisma-quarteirao.mapper';
import { PrismaService } from '../../prisma.service';

@PrismaRepository(QuarteiraoReadRepository)
@Injectable()
export class PrismaQuarteiraoReadRepository implements QuarteiraoReadRepository {
  constructor(private prisma: PrismaService) {}

  async findQuarteiraoById(id: string): Promise<Quarteirao | null> {
    const raw = await this.prisma.client.bairros_quadras.findFirst({
      where: { id, deleted_at: null },
    });
    return raw
      ? PrismaQuarteiraoMapper.quarteiraoToDomain(raw as any)
      : null;
  }

  async findAllQuarteiroes(
    filters: FilterQuarteiraoInput,
  ): Promise<Quarteirao[]> {
    const where = this.buildWhereQuarteiroes(filters);
    const rows = await this.prisma.client.bairros_quadras.findMany({
      where,
      orderBy: { codigo: 'asc' },
    });
    return rows.map((r) =>
      PrismaQuarteiraoMapper.quarteiraoToDomain(r as any),
    );
  }

  async findAllDistribuicoes(
    filters: FilterDistribuicaoInput,
  ): Promise<DistribuicaoQuarteirao[]> {
    const rows = await this.prisma.client.bairros_distribuicao.findMany({
      where: {
        ...(filters.clienteId != null && { cliente_id: filters.clienteId }),
        ciclo_id: filters.cicloId,
      },
    });
    return rows.map((r) =>
      PrismaQuarteiraoMapper.distribuicaoToDomain(r as any),
    );
  }

  async findDistribuicaoById(id: string): Promise<DistribuicaoQuarteirao | null> {
    const raw = await this.prisma.client.bairros_distribuicao.findUnique({
      where: { id },
    });
    return raw
      ? PrismaQuarteiraoMapper.distribuicaoToDomain(raw as any)
      : null;
  }

  async coberturaQuarteiraoCiclo(input: {
    clienteId: string;
    cicloId: string;
  }): Promise<CoberturaCicloResult> {
    const { clienteId, cicloId } = input;
    return this.prisma.client.$queryRaw<CoberturaQuarteiraoItem[]>(Prisma.sql`
      SELECT
        bq.id                                                                 AS quadra_id,
        bq.codigo                                                             AS quarteirao,
        COUNT(DISTINCT i.id)::int                                             AS total_imoveis,
        COUNT(DISTINCT v.imovel_id)::int                                      AS visitados,
        ROUND(
          COUNT(DISTINCT v.imovel_id) * 100.0
          / NULLIF(COUNT(DISTINCT i.id), 0), 1
        )::float                                                              AS pct_cobertura
      FROM bairros_quadras bq
      LEFT JOIN imoveis i
        ON (i.quadra_id = bq.id
            OR (i.quadra_id IS NULL AND i.quarteirao = bq.codigo AND i.cliente_id = ${clienteId}::uuid))
        AND i.deleted_at IS NULL
      LEFT JOIN vistorias v
        ON v.imovel_id = i.id
       AND v.ciclo     = (SELECT numero FROM ciclos WHERE id = ${cicloId}::uuid)
       AND v.deleted_at IS NULL
      WHERE bq.cliente_id = ${clienteId}::uuid
        AND bq.deleted_at IS NULL
      GROUP BY bq.id, bq.codigo
      ORDER BY bq.codigo
    `);
  }

  async findDistribuicaoTerritorialAtual(
    clienteId: string,
    agenteId?: string,
    bairroId?: string,
  ): Promise<DistribuicaoTerritorialItem[]> {
    const agenteFilter = agenteId
      ? Prisma.sql`AND t.agente_id = ${agenteId}::uuid`
      : Prisma.sql``;
    const bairroFilter = bairroId
      ? Prisma.sql`AND t.bairro_id = ${bairroId}::uuid`
      : Prisma.sql``;

    type RawRow = {
      quadra_id: string;
      codigo: string;
      bairro_id: string | null;
      bairro_nome: string | null;
      agente_id: string;
      agente_nome: string;
      ciclo_id_origem: string;
      updated_at: Date;
    };

    const rows = await this.prisma.client.$queryRaw<RawRow[]>(Prisma.sql`
      WITH territorial AS (
        SELECT DISTINCT ON (bd.quadra_id)
          bd.quadra_id,
          bq.codigo,
          bq.bairro_id,
          bd.agente_id,
          bd.ciclo_id   AS ciclo_id_origem,
          bd.updated_at
        FROM bairros_distribuicao bd
        JOIN bairros_quadras bq ON bq.id = bd.quadra_id AND bq.deleted_at IS NULL
        WHERE bd.cliente_id = ${clienteId}::uuid
        ORDER BY bd.quadra_id, bd.updated_at DESC
      )
      SELECT
        t.quadra_id,
        t.codigo,
        t.bairro_id,
        b.nome     AS bairro_nome,
        t.agente_id,
        u.nome     AS agente_nome,
        t.ciclo_id_origem,
        t.updated_at
      FROM territorial t
      LEFT JOIN bairros b ON b.id = t.bairro_id
      JOIN usuarios u ON u.id = t.agente_id
      WHERE 1=1
      ${agenteFilter}
      ${bairroFilter}
      ORDER BY t.codigo
    `);

    return rows.map(r => ({
      quadraId: r.quadra_id,
      codigo: r.codigo,
      bairroId: r.bairro_id,
      bairroNome: r.bairro_nome,
      agenteId: r.agente_id,
      agenteNome: r.agente_nome,
      cicloIdOrigem: r.ciclo_id_origem,
      updatedAt: r.updated_at,
    }));
  }

  private buildWhereQuarteiroes(filters: FilterQuarteiraoInput) {
    return {
      deleted_at: null,
      ...(filters.clienteId != null && { cliente_id: filters.clienteId }),
      ...(filters.codigo && {
        codigo: { contains: filters.codigo, mode: 'insensitive' as const },
      }),
      ...(filters.bairroId && { bairro_id: filters.bairroId }),
      ...(filters.ativo !== undefined && { ativo: filters.ativo }),
    };
  }
}
