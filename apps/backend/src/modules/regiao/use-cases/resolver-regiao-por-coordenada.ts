import { Injectable } from '@nestjs/common';

import { RegiaoReadRepository } from '../repositories/regiao-read.repository';

@Injectable()
export class ResolverRegiaoPorCoordenada {
  constructor(private readRepository: RegiaoReadRepository) {}

  async execute(clienteId: string, lat: number, lng: number): Promise<{ bairroId: string | null }> {
    const bairroId = await this.readRepository.findPorCoordenada(clienteId, lat, lng);
    return { bairroId };
  }
}
