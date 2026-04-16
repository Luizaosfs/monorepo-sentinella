import { Injectable } from '@nestjs/common';

import { Job } from '../entities/job';
import { JobReadRepository } from '../repositories/job-read.repository';

@Injectable()
export class FilterJob {
  constructor(private repository: JobReadRepository) {}

  async execute(status?: string): Promise<{ items: Job[] }> {
    const items = await this.repository.findAll(status);
    return { items };
  }
}
