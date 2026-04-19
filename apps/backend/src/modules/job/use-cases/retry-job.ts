import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { Job } from '../entities/job';
import { JOB_QUEUE_STATUS } from '../job-queue.constants';
import { JobReadRepository } from '../repositories/job-read.repository';
import { JobWriteRepository } from '../repositories/job-write.repository';

@Injectable()
export class RetryJob {
  constructor(
    private readRepository: JobReadRepository,
    private writeRepository: JobWriteRepository,
  ) {}

  async execute(id: string): Promise<{ job: Job }> {
    const job = await this.readRepository.findById(id);
    if (!job) throw new NotFoundException('Job não encontrado');
    if (job.status !== JOB_QUEUE_STATUS.falhou) {
      throw new BadRequestException('Apenas jobs com status "falhou" podem ser reiniciados');
    }
    job.status = JOB_QUEUE_STATUS.pendente;
    job.tentativas = 0;
    job.erro = undefined;
    await this.writeRepository.save(job);
    return { job };
  }
}
