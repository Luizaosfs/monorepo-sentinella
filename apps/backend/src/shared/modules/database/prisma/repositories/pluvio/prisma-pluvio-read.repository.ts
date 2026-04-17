import { FilterPluvioRunInputType } from '@modules/pluvio/dtos/filter-pluvio-run.input';
import { PluvioItem, PluvioRisco, PluvioRun } from '@modules/pluvio/entities/pluvio';
import {
  PluvioCondicaoVoo,
  PluvioReadRepository,
} from '@modules/pluvio/repositories/pluvio-read.repository';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import {
  PrismaPluvioItemMapper,
  PrismaPluvioRiscoMapper,
  PrismaPluvioRunMapper,
} from '../../mappers/prisma-pluvio.mapper';
import { PrismaService } from '../../prisma.service';

@PrismaRepository(PluvioReadRepository)
@Injectable()
export class PrismaPluvioReadRepository implements PluvioReadRepository {
  constructor(private prisma: PrismaService) {}

  async findRunById(id: string): Promise<PluvioRun | null> {
    const raw = await this.prisma.client.pluvio_operacional_run.findUnique({
      where: { id },
    });
    return raw ? PrismaPluvioRunMapper.toDomain(raw as any) : null;
  }

  async findRuns(filters: FilterPluvioRunInputType): Promise<PluvioRun[]> {
    const where = this.buildRunWhere(filters);
    const rows = await this.prisma.client.pluvio_operacional_run.findMany({
      where,
      orderBy: { dt_ref: 'desc' },
    });
    return rows.map((r) => PrismaPluvioRunMapper.toDomain(r as any));
  }

  async findLatestRun(clienteId: string): Promise<PluvioRun | null> {
    const raw = await this.prisma.client.pluvio_operacional_run.findFirst({
      where: { cliente_id: clienteId },
      orderBy: { dt_ref: 'desc' },
    });
    return raw ? PrismaPluvioRunMapper.toDomain(raw as any) : null;
  }

  async findItemById(id: string): Promise<PluvioItem | null> {
    const raw = await this.prisma.client.pluvio_operacional_item.findUnique({
      where: { id },
    });
    return raw ? PrismaPluvioItemMapper.toDomain(raw as any) : null;
  }

  async findItemsByRunId(runId: string): Promise<PluvioItem[]> {
    const rows = await this.prisma.client.pluvio_operacional_item.findMany({
      where: { run_id: runId },
      orderBy: { created_at: 'asc' },
    });
    return rows.map((r) => PrismaPluvioItemMapper.toDomain(r as any));
  }

  async findRiscoById(id: string): Promise<PluvioRisco | null> {
    const raw = await this.prisma.client.pluvio_risco.findUnique({ where: { id } });
    return raw ? PrismaPluvioRiscoMapper.toDomain(raw as any) : null;
  }

  async findRiscoByRegiaoIds(regiaoIds: string[]): Promise<PluvioRisco[]> {
    const rows = await this.prisma.client.pluvio_risco.findMany({
      where: { regiao_id: { in: regiaoIds } },
      orderBy: { dt_ref: 'desc' },
    });
    return rows.map((r) => PrismaPluvioRiscoMapper.toDomain(r as any));
  }

  async findRiscoByClienteEData(clienteId: string, data: Date): Promise<PluvioCondicaoVoo[]> {
    type Row = {
      regiao_id: string;
      chuva_24h: number | null;
      vento_kmh: number | null;
      temp_c: number | null;
      classificacao_final: string | null;
      prev_d1_mm: number | null;
    };
    const rows = await this.prisma.client.$queryRaw<Row[]>(
      Prisma.sql`
        SELECT pr.regiao_id,
               COALESCE(pr.chuva_24h, 0)::float   AS chuva_24h,
               COALESCE(pr.vento_kmh, 0)::float   AS vento_kmh,
               COALESCE(pr.temp_c, 0)::float      AS temp_c,
               pr.classificacao_final,
               pr.prev_d1_mm::float               AS prev_d1_mm
        FROM pluvio_risco pr
        JOIN regioes r ON r.id = pr.regiao_id
        WHERE r.cliente_id = ${clienteId}::uuid
          AND pr.dt_ref = ${data}::date
          AND r.deleted_at IS NULL
      `,
    );
    return rows.map((r) => ({
      regiaoId: r.regiao_id,
      chuva24h: r.chuva_24h ?? 0,
      ventoKmh: r.vento_kmh ?? 0,
      tempC: r.temp_c ?? 0,
      classificacaoFinal: r.classificacao_final,
      prevD1Mm: r.prev_d1_mm,
    }));
  }

  private buildRunWhere(filters: FilterPluvioRunInputType) {
    return {
      ...(filters.clienteId != null && { cliente_id: filters.clienteId }),
      ...(filters.dataReferenciaInicio || filters.dataReferenciaFim
        ? {
            dt_ref: {
              ...(filters.dataReferenciaInicio && { gte: filters.dataReferenciaInicio }),
              ...(filters.dataReferenciaFim && { lte: filters.dataReferenciaFim }),
            },
          }
        : {}),
    };
  }
}
