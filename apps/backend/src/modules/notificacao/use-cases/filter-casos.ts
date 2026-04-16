import { Injectable } from '@nestjs/common';

import { CasoNotificado } from '../entities/notificacao';
import { NotificacaoReadRepository } from '../repositories/notificacao-read.repository';

@Injectable()
export class FilterCasos {
  constructor(private repository: NotificacaoReadRepository) {}

  async execute(
    clienteId: string,
    filters: { status?: string; regiaoId?: string },
  ): Promise<{ items: CasoNotificado[] }> {
    const items = await this.repository.findCasos(clienteId, filters);
    return { items };
  }
}
