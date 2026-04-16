import { FilterDistribuicaoInput } from '@modules/quarteirao/dtos/filter-distribuicao.input';
import { FilterQuarteiraoInput } from '@modules/quarteirao/dtos/filter-quarteirao.input';
import {
  CoberturaCicloResult,
  QuarteiraoReadRepository,
} from '@modules/quarteirao/repositories/quarteirao-read.repository';
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
        ...(filters.clienteId && { cliente_id: filters.clienteId }),
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

    const totalQuarteiroes = await this.prisma.client.quarteiroes.count({
      where: {
        cliente_id: clienteId,
        deleted_at: null,
        ativo: true,
      },
    });

    const comAgente = await this.prisma.client.quarteiroes.count({
      where: {
        cliente_id: clienteId,
        deleted_at: null,
        ativo: true,
        distribuicoes: {
          some: { ciclo },
        },
      },
    });

    const semAgente = Math.max(0, totalQuarteiroes - comAgente);

    return {
      clienteId,
      ciclo,
      totalQuarteiroes,
      comAgente,
      semAgente,
    };
  }

  private buildWhereQuarteiroes(filters: FilterQuarteiraoInput) {
    return {
      deleted_at: null,
      ...(filters.clienteId && { cliente_id: filters.clienteId }),
      ...(filters.codigo && {
        codigo: { contains: filters.codigo, mode: 'insensitive' as const },
      }),
      ...(filters.regiaoId && { regiao_id: filters.regiaoId }),
      ...(filters.ativo !== undefined && { ativo: filters.ativo }),
    };
  }
}
