import { Injectable } from '@nestjs/common';

import {
  ImovelHistoricoAcesso,
  ImovelReadRepository,
} from '../repositories/imovel-read.repository';

@Injectable()
export class ListImovelProblematicos {
  constructor(private imovelReadRepository: ImovelReadRepository) {}

  async execute(clienteId: string): Promise<{ items: ImovelHistoricoAcesso[] }> {
    const items = await this.imovelReadRepository.listProblematicos(clienteId);
    return { items };
  }
}
