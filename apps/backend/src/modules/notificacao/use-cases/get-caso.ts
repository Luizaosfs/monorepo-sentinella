import { Injectable } from '@nestjs/common';

import { CasoNotificado } from '../entities/notificacao';
import { NotificacaoException } from '../errors/notificacao.exception';
import { NotificacaoReadRepository } from '../repositories/notificacao-read.repository';

@Injectable()
export class GetCaso {
  constructor(private repository: NotificacaoReadRepository) {}

  async execute(id: string, clienteId: string | null): Promise<{ caso: CasoNotificado }> {
    const caso = await this.repository.findCasoById(id, clienteId);
    if (!caso) throw NotificacaoException.casoNotFound();
    return { caso };
  }
}
