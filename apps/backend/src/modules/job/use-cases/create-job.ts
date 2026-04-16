import { Injectable } from '@nestjs/common';

import { CreateJobBody } from '../dtos/create-job.body';
import { Job } from '../entities/job';
import { JOB_QUEUE_STATUS } from '../job-queue.constants';
import { JobWriteRepository } from '../repositories/job-write.repository';

@Injectable()
export class CreateJob {
  constructor(private repository: JobWriteRepository) {}

  async execute(input: CreateJobBody): Promise<{ job: Job }> {
    const entity = new Job(
      {
        tipo: input.tipo,
        payload: input.payload,
        status: JOB_QUEUE_STATUS.pendente,
        tentativas: 0,
        agendadoEm: input.agendadoEm,
      },
      {},
    );
    const created = await this.repository.create(entity);
    return { job: created };
  }
}
