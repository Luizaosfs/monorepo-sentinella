import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { Job } from '../entities/job';
import { JOB_QUEUE_STATUS } from '../job-queue.constants';
import { JobReadRepository } from '../repositories/job-read.repository';
import { JobWriteRepository } from '../repositories/job-write.repository';

@Injectable()
export class CancelJob {
  constructor(
    private readRepository: JobReadRepository,
    private writeRepository: JobWriteRepository,
  ) {}

  async execute(id: string): Promise<{ job: Job }> {
    const job = await this.readRepository.findById(id);
    if (!job) throw new NotFoundException('Job não encontrado');
    const cancelaveis = [JOB_QUEUE_STATUS.pendente, JOB_QUEUE_STATUS.emExecucao] as string[];
    if (!cancelaveis.includes(job.status)) {
      throw new BadRequestException('Apenas jobs pendentes ou em execução podem ser cancelados');
    }
    job.status = JOB_QUEUE_STATUS.cancelado;
    await this.writeRepository.save(job);
    return { job };
  }
}
