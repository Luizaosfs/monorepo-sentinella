import { Injectable } from '@nestjs/common';

import { PipelineRun } from '../entities/drone';
import { DroneException } from '../errors/drone.exception';
import { DroneReadRepository } from '../repositories/drone-read.repository';

@Injectable()
export class GetPipeline {
  constructor(private repository: DroneReadRepository) {}

  async execute(id: string): Promise<{ pipeline: PipelineRun }> {
    const pipeline = await this.repository.findPipelineById(id);
    if (!pipeline) throw DroneException.pipelineNotFound();
    return { pipeline };
  }
}
