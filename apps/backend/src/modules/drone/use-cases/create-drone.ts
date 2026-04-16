import { Injectable } from '@nestjs/common';

import { CreateDroneBody } from '../dtos/create-drone.body';
import { Drone } from '../entities/drone';
import { DroneWriteRepository } from '../repositories/drone-write.repository';

@Injectable()
export class CreateDrone {
  constructor(private repository: DroneWriteRepository) {}

  async execute(clienteId: string, input: CreateDroneBody): Promise<{ drone: Drone }> {
    const entity = new Drone(
      {
        clienteId,
        nome: input.nome,
        modelo: input.modelo,
        serial: input.serial,
        ativo: input.ativo ?? true,
      },
      {},
    );
    const created = await this.repository.createDrone(entity);
    return { drone: created };
  }
}
