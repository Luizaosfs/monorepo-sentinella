import { Injectable } from '@nestjs/common';

import { ItemNotificacaoEsus } from '../entities/notificacao';
import { NotificacaoReadRepository } from '../repositories/notificacao-read.repository';

@Injectable()
export class FilterEsus {
  constructor(private repository: NotificacaoReadRepository) {}

  async execute(clienteId: string): Promise<{ items: ItemNotificacaoEsus[] }> {
    const items = await this.repository.findEsus(clienteId);
    return { items };
  }
}
