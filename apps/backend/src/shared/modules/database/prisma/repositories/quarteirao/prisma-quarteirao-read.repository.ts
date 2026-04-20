import { FilterDistribuicaoInput } from '@modules/quarteirao/dtos/filter-distribuicao.input';
import { FilterQuarteiraoInput } from '@modules/quarteirao/dtos/filter-quarteirao.input';
import {
  CoberturaCicloResult,
  CoberturaQuarteiraoItem,
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
    const raw = await this.prisma.client.quarteiroes.findFirst({
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
    const rows = await this.prisma.client.quarteiroes.findMany({
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
    const rows = await this.prisma.client.distribuicao_quarteirao.findMany({
      where: {
        ...(filters.clienteId != null && { cliente_id: filters.clienteId }),
        ciclo: filters.ciclo,
      },
      orderBy: { quarteirao: 'asc' },
    });
    return rows.map((r) =>
      PrismaQuarteiraoMapper.distribuicaoToDomain(r as any),
    );
  }

  async findDistribuicaoById(id: string): Promise<DistribuicaoQuarteirao | null> {
    const raw = await this.prisma.client.distribuicao_quarteirao.findUnique({
      where: { id },
    });
    return raw
      ? PrismaQuarteiraoMapper.distribuicaoToDomain(raw as any)
      : null;
  }

  async coberturaQuarteiraoCiclo(input: {
    clienteId: string;
    ciclo: number;
  }): Promise<CoberturaCicloResult> {
    const { clienteId, ciclo } = input;
    return this.prisma.client.$queryRaw<CoberturaQuarteiraoItem[]>(Prisma.sql`
      SELECT
        i.quarteirao,
        COUNT(DISTINCT i.id)::int          AS total_imoveis,
        COUNT(DISTINCT v.imovel_id)::int   AS visitados,
        ROUND(
          COUNT(DISTINCT v.imovel_id) * 100.0
          / NULLIF(COUNT(DISTINCT i.id), 0), 1
        )::float                           AS pct_cobertura
      FROM imoveis i
      LEFT JOIN vistorias v
        ON v.imovel_id = i.id
       AND v.ciclo      = ${ciclo}
       AND v.deleted_at IS NULL
      WHERE i.cliente_id = ${clienteId}::uuid
        AND i.deleted_at  IS NULL
        AND i.quarteirao  IS NOT NULL
        AND i.quarteirao  <> ''
      GROUP BY i.quarteirao
      ORDER BY i.quarteirao
    `);
  }

  private buildWhereQuarteiroes(filters: FilterQuarteiraoInput) {
    return {
      deleted_at: null,
      ...(filters.clienteId != null && { cliente_id: filters.clienteId }),
      ...(filters.codigo && {
        codigo: { contains: filters.codigo, mode: 'insensitive' as const },
      }),
      ...(filters.regiaoId && { regiao_id: filters.regiaoId }),
      ...(filters.ativo !== undefined && { ativo: filters.ativo }),
    };
  }
}
