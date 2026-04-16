import { Injectable } from '@nestjs/common';
import { Job } from 'src/modules/job/entities/job';
import { JobWriteRepository } from 'src/modules/job/repositories/job-write.repository';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaJobMapper } from '../../mappers/prisma-job.mapper';
import { PrismaService } from '../../prisma.service';

@PrismaRepository(JobWriteRepository)
@Injectable()
export class PrismaJobWriteRepository implements JobWriteRepository {
  constructor(private prisma: PrismaService) {}

  async create(entity: Job): Promise<Job> {
    const row = await this.prisma.client.job_queue.create({
      data: PrismaJobMapper.toPrisma(entity) as any,
    });
    return PrismaJobMapper.toDomain(row);
  }

  async save(entity: Job): Promise<void> {
    await this.prisma.client.job_queue.update({
      where: { id: entity.id },
      data: PrismaJobMapper.toPrisma(entity) as any,
    });
  }
}
