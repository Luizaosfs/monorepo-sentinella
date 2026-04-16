import { Injectable } from '@nestjs/common';

import { NotificacaoWriteRepository } from '../repositories/notificacao-write.repository';

@Injectable()
export class ProximoProtocolo {
  constructor(private writeRepository: NotificacaoWriteRepository) {}

  async execute(clienteId: string): Promise<{ protocolo: string }> {
    const protocolo = await this.writeRepository.nextProtocolo(clienteId);
    return { protocolo };
  }
}
