import { Injectable } from '@nestjs/common';

import { CreateVooBody } from '../dtos/create-drone.body';
import { Voo } from '../entities/drone';
import { DroneWriteRepository } from '../repositories/drone-write.repository';

@Injectable()
export class CreateVoo {
  constructor(private repository: DroneWriteRepository) {}

  async execute(clienteId: string, input: CreateVooBody): Promise<{ voo: Voo }> {
    const entity = new Voo(
      {
        inicio: input.inicio,
        fim: input.fim,
        planejamentoId: input.planejamentoId,
        pilotoId: input.pilotoId,
        duracaoMin: input.duracaoMin,
        km: input.km,
        ha: input.ha,
        baterias: input.baterias,
        fotos: input.fotos,
      },
      {},
    );
    const created = await this.repository.createVoo(entity);
    return { voo: created };
  }
}
