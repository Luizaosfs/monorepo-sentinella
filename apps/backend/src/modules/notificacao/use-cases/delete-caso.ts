import { Injectable } from '@nestjs/common';

import { NotificacaoException } from '../errors/notificacao.exception';
import { NotificacaoReadRepository } from '../repositories/notificacao-read.repository';
import { NotificacaoWriteRepository } from '../repositories/notificacao-write.repository';

@Injectable()
export class DeleteCaso {
  constructor(
    private readRepository: NotificacaoReadRepository,
    private writeRepository: NotificacaoWriteRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const caso = await this.readRepository.findCasoById(id);
    if (!caso) throw NotificacaoException.casoNotFound();
    await this.writeRepository.deleteCaso(id);
  }
}
