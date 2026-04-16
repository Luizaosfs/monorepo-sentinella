import { Injectable } from '@nestjs/common';

import { CasoNotificado } from '../entities/notificacao';
import { NotificacaoException } from '../errors/notificacao.exception';
import { NotificacaoReadRepository } from '../repositories/notificacao-read.repository';

@Injectable()
export class GetCaso {
  constructor(private repository: NotificacaoReadRepository) {}

  async execute(id: string): Promise<{ caso: CasoNotificado }> {
    const caso = await this.repository.findCasoById(id);
    if (!caso) throw NotificacaoException.casoNotFound();
    return { caso };
  }
}
