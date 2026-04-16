import { Injectable } from '@nestjs/common';

import { Job } from '../entities/job';

@Injectable()
export abstract class JobWriteRepository {
  abstract create(entity: Job): Promise<Job>;
  abstract save(entity: Job): Promise<void>;
}
