import { Injectable } from '@nestjs/common';

import { Drone, Voo, YoloFeedback } from '../entities/drone';

@Injectable()
export abstract class DroneWriteRepository {
  abstract createDrone(entity: Drone): Promise<Drone>;
  abstract saveDrone(entity: Drone): Promise<void>;
  abstract deleteDrone(id: string, clienteId: string): Promise<void>;
  abstract createVoo(entity: Voo): Promise<Voo>;
  abstract saveVoo(entity: Voo): Promise<void>;
  abstract deleteVoo(id: string): Promise<void>;
  abstract createYoloFeedback(entity: YoloFeedback): Promise<YoloFeedback>;
}
