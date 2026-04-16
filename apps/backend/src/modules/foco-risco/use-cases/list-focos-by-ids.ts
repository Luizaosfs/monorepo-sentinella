import { Injectable } from '@nestjs/common';

import { FocoRisco } from '../entities/foco-risco';
import { FocoRiscoReadRepository } from '../repositories/foco-risco-read.repository';
import { FocoRiscoViewModel } from '../view-model/foco-risco';

@Injectable()
export class ListFocosByIds {
  constructor(private repository: FocoRiscoReadRepository) {}

  async execute(ids: string[], clienteId: string) {
    if (!ids.length) return { focos: [] as ReturnType<typeof FocoRiscoViewModel.toHttp>[] };
    const focos = await this.repository.findManyByIds(ids, clienteId);
    return { focos: focos.map((f) => FocoRiscoViewModel.toHttp(f)) };
  }
}
