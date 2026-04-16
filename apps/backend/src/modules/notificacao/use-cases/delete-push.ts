import { Injectable } from '@nestjs/common';

import { NotificacaoWriteRepository } from '../repositories/notificacao-write.repository';

@Injectable()
export class DeletePush {
  constructor(private repository: NotificacaoWriteRepository) {}

  async execute(id: string): Promise<void> {
    await this.repository.deletePush(id);
  }
}
