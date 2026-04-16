import { Injectable } from '@nestjs/common';

import { DroneException } from '../errors/drone.exception';
import { DroneReadRepository } from '../repositories/drone-read.repository';
import { DroneWriteRepository } from '../repositories/drone-write.repository';

@Injectable()
export class DeleteDrone {
  constructor(
    private readRepository: DroneReadRepository,
    private writeRepository: DroneWriteRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const drone = await this.readRepository.findDroneById(id);
    if (!drone) throw DroneException.notFound();
    await this.writeRepository.deleteDrone(id);
  }
}
