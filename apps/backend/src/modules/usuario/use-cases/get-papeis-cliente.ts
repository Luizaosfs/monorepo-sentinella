import { Injectable } from '@nestjs/common';

import { UsuarioReadRepository } from '../repositories/usuario-read.repository';

@Injectable()
export class GetPapeisCliente {
  constructor(private readRepository: UsuarioReadRepository) {}

  async execute(clienteId: string | null) {
    const papeis = await this.readRepository.findPapeisCliente(clienteId);
    return { papeis };
  }
}
