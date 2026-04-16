import { Injectable } from '@nestjs/common';

import { FocoRiscoReadRepository } from '../repositories/foco-risco-read.repository';
import { FocoRiscoViewModel } from '../view-model/foco-risco';

@Injectable()
export class GetFocoHistorico {
  constructor(private repository: FocoRiscoReadRepository) {}

  async execute(focoId: string) {
    const foco = await this.repository.findByIdComHistorico(focoId);
    if (!foco) return [];
    return (foco.historico ?? []).map(FocoRiscoViewModel.historicoToHttp);
  }
}
