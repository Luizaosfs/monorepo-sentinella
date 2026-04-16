import { Injectable } from '@nestjs/common';

import { NotificacaoException } from '../errors/notificacao.exception';
import { NotificacaoReadRepository } from '../repositories/notificacao-read.repository';
import { NotificacaoWriteRepository } from '../repositories/notificacao-write.repository';

@Injectable()
export class DeleteUnidade {
  constructor(
    private readRepository: NotificacaoReadRepository,
    private writeRepository: NotificacaoWriteRepository,
  ) {}

  async execute(id: string): Promise<void> {
    const unidade = await this.readRepository.findUnidadeById(id);
    if (!unidade) throw NotificacaoException.unidadeNotFound();
    await this.writeRepository.deleteUnidade(id);
  }
}
