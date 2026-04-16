import { ImportLog } from '@modules/import-log/entities/import-log';
import { ImportLogWriteRepository } from '@modules/import-log/repositories/import-log-write.repository';
import { Injectable } from '@nestjs/common';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaImportLogMapper } from '../../mappers/prisma-import-log.mapper';
import { PrismaService } from '../../prisma.service';

@PrismaRepository(ImportLogWriteRepository)
@Injectable()
export class PrismaImportLogWriteRepository implements ImportLogWriteRepository {
  constructor(private prisma: PrismaService) {}

  async create(entity: ImportLog): Promise<ImportLog> {
    const data = PrismaImportLogMapper.toPrismaCreate(entity);
    const created = await this.prisma.client.import_log.create({ data });
    return PrismaImportLogMapper.toDomain(created as any);
  }
}
