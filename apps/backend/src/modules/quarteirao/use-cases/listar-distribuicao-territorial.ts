import { Injectable } from '@nestjs/common';

import { QuarteiraoReadRepository } from '../repositories/quarteirao-read.repository';

@Injectable()
export class ListarDistribuicaoTerritorial {
  constructor(private readRepository: QuarteiraoReadRepository) {}

  async execute(clienteId: string, agenteId?: string, bairroId?: string) {
    return this.readRepository.findDistribuicaoTerritorialAtual(
      clienteId,
      agenteId,
      bairroId,
    );
  }
}
