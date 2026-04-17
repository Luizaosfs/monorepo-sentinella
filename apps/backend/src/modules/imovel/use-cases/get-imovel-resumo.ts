import { Injectable } from '@nestjs/common';

import { ImovelResumo, ImovelReadRepository } from '../repositories/imovel-read.repository';

@Injectable()
export class GetImovelResumo {
  constructor(private imovelReadRepository: ImovelReadRepository) {}

  async execute(id: string, clienteId?: string | null): Promise<{ resumo: ImovelResumo | null }> {
    const resumo = await this.imovelReadRepository.getResumoById(id, clienteId);
    return { resumo };
  }
}
