import { Injectable } from '@nestjs/common';

import { ImovelResumo, ImovelReadRepository } from '../repositories/imovel-read.repository';

@Injectable()
export class ListImovelResumo {
  constructor(private imovelReadRepository: ImovelReadRepository) {}

  async execute(clienteId: string, regiaoId?: string): Promise<{ items: ImovelResumo[] }> {
    const items = await this.imovelReadRepository.listResumo(clienteId, regiaoId);
    return { items };
  }
}
