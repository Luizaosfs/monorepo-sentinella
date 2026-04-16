import { PluvioItem, PluvioRisco, PluvioRun } from '@modules/pluvio/entities/pluvio';
import {
  PluvioWriteRepository,
  SlaInput,
} from '@modules/pluvio/repositories/pluvio-write.repository';
import { Injectable } from '@nestjs/common';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import {
  PrismaPluvioItemMapper,
  PrismaPluvioRiscoMapper,
  PrismaPluvioRunMapper,
} from '../../mappers/prisma-pluvio.mapper';
import { PrismaService } from '../../prisma.service';

const CHUNK_SIZE = 500;

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

@PrismaRepository(PluvioWriteRepository)
@Injectable()
export class PrismaPluvioWriteRepository implements PluvioWriteRepository {
  constructor(private prisma: PrismaService) {}

  async createRun(run: PluvioRun): Promise<PluvioRun> {
    const data = PrismaPluvioRunMapper.toPrisma(run);
    const created = await this.prisma.client.pluvio_operacional_run.create({
      data: data as any,
    });
    return PrismaPluvioRunMapper.toDomain(created as any);
  }

  async saveRun(run: PluvioRun): Promise<void> {
    const data = PrismaPluvioRunMapper.toPrisma(run);
    await this.prisma.client.pluvio_operacional_run.update({
      where: { id: run.id },
      data: data as any,
    });
  }

  async deleteRun(id: string): Promise<void> {
    await this.prisma.client.pluvio_operacional_run.delete({ where: { id } });
  }

  async upsertItem(item: PluvioItem): Promise<PluvioItem> {
    const data = PrismaPluvioItemMapper.toPrisma(item);
    const upserted = await this.prisma.client.pluvio_operacional_item.upsert({
      where: { id: item.id ?? '00000000-0000-0000-0000-000000000000' },
      update: data as any,
      create: data as any,
    });
    return PrismaPluvioItemMapper.toDomain(upserted as any);
  }

  async bulkInsertItems(items: PluvioItem[]): Promise<void> {
    const chunks = chunk(items, CHUNK_SIZE);
    for (const batch of chunks) {
      await this.prisma.client.pluvio_operacional_item.createMany({
        data: batch.map((item) => PrismaPluvioItemMapper.toPrisma(item)) as any,
        skipDuplicates: true,
      });
    }
  }

  async deleteItem(id: string): Promise<void> {
    await this.prisma.client.pluvio_operacional_item.delete({ where: { id } });
  }

  async upsertRisco(risco: PluvioRisco): Promise<PluvioRisco> {
    const data = PrismaPluvioRiscoMapper.toPrisma(risco);
    const upserted = await this.prisma.client.pluvio_risco.upsert({
      where: { id: risco.id ?? '00000000-0000-0000-0000-000000000000' },
      update: data as any,
      create: data as any,
    });
    return PrismaPluvioRiscoMapper.toDomain(upserted as any);
  }

  async bulkInsertRisco(riscos: PluvioRisco[]): Promise<void> {
    const chunks = chunk(riscos, CHUNK_SIZE);
    for (const batch of chunks) {
      await this.prisma.client.pluvio_risco.createMany({
        data: batch.map((r) => PrismaPluvioRiscoMapper.toPrisma(r)) as any,
        skipDuplicates: true,
      });
    }
  }

  async deleteRisco(id: string): Promise<void> {
    await this.prisma.client.pluvio_risco.delete({ where: { id } });
  }

  async createSlasBulk(slas: SlaInput[]): Promise<number> {
    if (!slas.length) return 0;
    const now = new Date();
    const result = await this.prisma.client.sla_operacional.createMany({
      data: slas.map((s) => ({
        cliente_id: s.clienteId,
        item_id: s.itemId,
        prioridade: s.prioridade,
        sla_horas: s.slaHoras,
        inicio: now,
        prazo_final: new Date(now.getTime() + s.slaHoras * 3_600_000),
        status: 'pendente',
      })),
    });
    return result.count;
  }
}
