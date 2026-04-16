import { Injectable } from '@nestjs/common';

import { CreateYoloFeedbackBody } from '../dtos/create-drone.body';
import { YoloFeedback } from '../entities/drone';
import { DroneWriteRepository } from '../repositories/drone-write.repository';

@Injectable()
export class CreateYoloFeedback {
  constructor(private repository: DroneWriteRepository) {}

  async execute(
    clienteId: string,
    userId: string | undefined,
    input: CreateYoloFeedbackBody,
  ): Promise<{ feedback: YoloFeedback }> {
    const entity = new YoloFeedback(
      {
        levantamentoItemId: input.levantamentoItemId,
        clienteId,
        confirmado: input.confirmado,
        observacao: input.observacao,
        registradoPor: userId,
      },
      {},
    );
    const created = await this.repository.createYoloFeedback(entity);
    return { feedback: created };
  }
}
