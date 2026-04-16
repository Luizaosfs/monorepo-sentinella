import { Injectable } from '@nestjs/common';
import { Job } from 'src/modules/job/entities/job';
import { JOB_QUEUE_STATUS } from 'src/modules/job/job-queue.constants';
import { JobReadRepository } from 'src/modules/job/repositories/job-read.repository';

import { PrismaRepository } from '@/decorators/prisma-repository.decorator';

import { PrismaJobMapper } from '../../mappers/prisma-job.mapper';
import { PrismaService } from '../../prisma.service';

@PrismaRepository(JobReadRepository)
@Injectable()
export class PrismaJobReadRepository implements JobReadRepository {
  constructor(private prisma: PrismaService) {}

  async findPendentes(limit = 10): Promise<Job[]> {
    const rows = await this.prisma.client.job_queue.findMany({
      where: { status: JOB_QUEUE_STATUS.pendente },
      orderBy: { executar_em: 'asc' },
      take: limit,
    });
    return rows.map(PrismaJobMapper.toDomain);
  }

  async findAll(status?: string): Promise<Job[]> {
    const rows = await this.prisma.client.job_queue.findMany({
      where: status ? { status } : {},
      orderBy: { criado_em: 'desc' },
      take: 100,
    });
    return rows.map(PrismaJobMapper.toDomain);
  }

  async findById(id: string): Promise<Job | null> {
    const row = await this.prisma.client.job_queue.findUnique({
      where: { id },
    });
    return row ? PrismaJobMapper.toDomain(row) : null;
  }
}
