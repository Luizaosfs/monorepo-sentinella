import { Injectable } from '@nestjs/common';

import { CicloReadRepository } from '../../ciclo/repositories/ciclo-read.repository';

@Injectable()
export class NormalizarCicloFoco {
  constructor(private cicloReadRepository: CicloReadRepository) {}

  async execute(clienteId: string, cicloInput?: number): Promise<number | undefined> {
    if (cicloInput != null && cicloInput >= 1 && cicloInput <= 6) return cicloInput;
    const ativo = await this.cicloReadRepository.findAtivo(clienteId);
    return ativo?.numero;
  }
}
