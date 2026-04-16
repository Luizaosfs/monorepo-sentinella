import { Injectable } from '@nestjs/common';

import { Job } from '../entities/job';
import { JobReadRepository } from '../repositories/job-read.repository';

@Injectable()
export class GetJob {
  constructor(private repository: JobReadRepository) {}

  async execute(id: string): Promise<{ job: Job | null }> {
    const job = await this.repository.findById(id);
    return { job };
  }
}
