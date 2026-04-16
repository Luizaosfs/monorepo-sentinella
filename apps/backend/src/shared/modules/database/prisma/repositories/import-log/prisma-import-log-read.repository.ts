import { FilterImportLogInput } from '@modules/import-log/dtos/filter-import-log.input';
import { ImportLog } from '@modules/import-log/entities/import-log';
import { ImportLogReadRepository } from '@modules/import-log/repositories/import-log-read.repository';
import { Injectable } from '@nestjs/common';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaImportLogMapper } from '../../mappers/prisma-import-log.mapper';
import { PrismaService } from '../../prisma.service';

@PrismaRepository(ImportLogReadRepository)
@Injectable()
export class PrismaImportLogReadRepository implements ImportLogReadRepository {
  constructor(private prisma: PrismaService) {}

  async findById(id: string): Promise<ImportLog | null> {
    const raw = await this.prisma.client.import_log.findUnique({
      where: { id },
    });
    return raw ? PrismaImportLogMapper.toDomain(raw as any) : null;
  }

  async findAll(filters: FilterImportLogInput): Promise<ImportLog[]> {
    const where = this.buildWhere(filters);
    const rows = await this.prisma.client.import_log.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
    return rows.map((r) => PrismaImportLogMapper.toDomain(r as any));
  }

  private buildWhere(filters: FilterImportLogInput) {
    return {
      ...(filters.clienteId && { cliente_id: filters.clienteId }),
      ...(filters.status && { status: filters.status }),
    };
  }
}
