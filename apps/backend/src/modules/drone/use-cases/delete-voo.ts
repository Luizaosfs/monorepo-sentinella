import { Injectable } from '@nestjs/common';

import { DroneException } from '../errors/drone.exception';
import { DroneReadRepository } from '../repositories/drone-read.repository';
import { DroneWriteRepository } from '../repositories/drone-write.repository';

@Injectable()
export class DeleteVoo {
  constructor(
    private readRepository: DroneReadRepository,
    private writeRepository: DroneWriteRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const voo = await this.readRepository.findVooById(id);
    if (!voo) throw DroneException.notFound();
    await this.writeRepository.deleteVoo(id);
  }
}
