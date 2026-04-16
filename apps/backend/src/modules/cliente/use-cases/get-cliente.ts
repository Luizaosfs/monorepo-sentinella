import { Injectable } from '@nestjs/common';

import { ClienteException } from '../errors/cliente.exception';
import { ClienteReadRepository } from '../repositories/cliente-read.repository';

@Injectable()
export class GetCliente {
  constructor(private repository: ClienteReadRepository) {}

  async execute(id: string) {
    const cliente = await this.repository.findById(id);

    if (!cliente) {
      throw ClienteException.notFound();
    }

    return { cliente };
  }
}
