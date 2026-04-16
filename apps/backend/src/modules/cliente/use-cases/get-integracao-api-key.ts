import { Injectable } from '@nestjs/common';

import { ClienteException } from '../errors/cliente.exception';
import { ClienteReadRepository } from '../repositories/cliente-read.repository';

@Injectable()
export class GetIntegracaoApiKey {
  constructor(private readRepository: ClienteReadRepository) {}

  async execute(id: string) {
    const integracao = await this.readRepository.findIntegracaoApiKey(id);
    if (!integracao) throw ClienteException.notFound();
    return { integracao };
  }
}
