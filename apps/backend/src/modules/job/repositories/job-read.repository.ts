import { Injectable } from '@nestjs/common';

import { Job } from '../entities/job';

@Injectable()
export abstract class JobReadRepository {
  abstract findPendentes(limit?: number): Promise<Job[]>;
  abstract findAll(status?: string): Promise<Job[]>;
  abstract findById(id: string): Promise<Job | null>;
}
