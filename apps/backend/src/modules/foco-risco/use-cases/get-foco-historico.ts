import { Injectable } from '@nestjs/common';

import { FocoRiscoReadRepository } from '../repositories/foco-risco-read.repository';
import { FocoRiscoViewModel } from '../view-model/foco-risco';

@Injectable()
export class GetFocoHistorico {
  constructor(private repository: FocoRiscoReadRepository) {}

  async execute(focoId: string, clienteId?: string | null) {
    const foco = await this.repository.findByIdComHistorico(focoId, clienteId);
    if (!foco) return [];
    return (foco.historico ?? []).map(FocoRiscoViewModel.historicoToHttp);
  }
}
