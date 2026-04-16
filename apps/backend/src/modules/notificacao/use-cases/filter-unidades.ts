import { Injectable } from '@nestjs/common';

import { UnidadeSaude } from '../entities/notificacao';
import { NotificacaoReadRepository } from '../repositories/notificacao-read.repository';

@Injectable()
export class FilterUnidades {
  constructor(private repository: NotificacaoReadRepository) {}

  async execute(clienteId: string): Promise<{ items: UnidadeSaude[] }> {
    const items = await this.repository.findUnidades(clienteId);
    return { items };
  }
}
