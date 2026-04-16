import { Injectable } from '@nestjs/common';

import { SaveDroneBody } from '../dtos/create-drone.body';
import { Drone } from '../entities/drone';
import { DroneException } from '../errors/drone.exception';
import { DroneReadRepository } from '../repositories/drone-read.repository';
import { DroneWriteRepository } from '../repositories/drone-write.repository';

@Injectable()
export class SaveDrone {
  constructor(
    private readRepository: DroneReadRepository,
    private writeRepository: DroneWriteRepository,
  ) {}

  async execute(id: string, input: SaveDroneBody): Promise<{ drone: Drone }> {
    const drone = await this.readRepository.findDroneById(id);
    if (!drone) throw DroneException.notFound();

    if (input.nome !== undefined) drone.nome = input.nome;
    if (input.modelo !== undefined) drone.modelo = input.modelo;
    if (input.serial !== undefined) drone.serial = input.serial;
    if (input.ativo !== undefined) drone.ativo = input.ativo;

    await this.writeRepository.saveDrone(drone);
    return { drone };
  }
}
