import { Injectable } from '@nestjs/common';

import { CicloReadRepository } from '../repositories/ciclo-read.repository';

@Injectable()
export class GetCicloProgresso {
  constructor(private repository: CicloReadRepository) {}

  async execute(clienteId: string) {
    const progresso = await this.repository.findProgresso(clienteId);
    return { progresso };
  }
}
