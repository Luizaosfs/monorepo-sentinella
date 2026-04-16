import { Injectable } from '@nestjs/common';

import { Drone, PipelineRun, Voo } from '../entities/drone';

@Injectable()
export abstract class DroneReadRepository {
  abstract findDrones(clienteId: string): Promise<Drone[]>;
  abstract findDroneById(id: string): Promise<Drone | null>;
  abstract findVoos(clienteId: string): Promise<Voo[]>;
  abstract findVooById(id: string): Promise<Voo | null>;
  abstract findPipelines(clienteId: string): Promise<PipelineRun[]>;
  abstract findPipelineById(id: string): Promise<PipelineRun | null>;
}
