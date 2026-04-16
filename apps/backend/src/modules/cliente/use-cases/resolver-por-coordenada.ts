import { Injectable } from '@nestjs/common';

import { ClienteException } from '../errors/cliente.exception';
import { ClienteReadRepository } from '../repositories/cliente-read.repository';
import { ClienteViewModel } from '../view-model/cliente';

@Injectable()
export class ResolverPorCoordenada {
  constructor(private readRepository: ClienteReadRepository) {}

  async execute(lat: number, lng: number) {
    const cliente = await this.readRepository.findPorCoordenada(lat, lng);
    if (!cliente) throw ClienteException.notFound();
    return { cliente: ClienteViewModel.toHttp(cliente) };
  }
}
