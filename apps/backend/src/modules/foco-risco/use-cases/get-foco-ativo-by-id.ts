import { Injectable } from '@nestjs/common';

import { FocoRiscoReadRepository } from '../repositories/foco-risco-read.repository';
import { FocoRiscoViewModel } from '../view-model/foco-risco';

const TERMINAL_STATUSES = ['resolvido', 'descartado'];

@Injectable()
export class GetFocoAtivoById {
  constructor(private repository: FocoRiscoReadRepository) {}

  async execute(id: string, clienteId?: string | null) {
    const foco = await this.repository.findById(id, clienteId);
    if (!foco || TERMINAL_STATUSES.includes(foco.status)) return null;
    return FocoRiscoViewModel.toHttp(foco);
  }
}
