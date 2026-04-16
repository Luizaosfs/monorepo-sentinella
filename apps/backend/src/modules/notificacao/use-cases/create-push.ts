import { Injectable } from '@nestjs/common';

import { CreatePushBody } from '../dtos/create-notificacao.body';
import { PushSubscription } from '../entities/notificacao';
import { NotificacaoWriteRepository } from '../repositories/notificacao-write.repository';

@Injectable()
export class CreatePush {
  constructor(private repository: NotificacaoWriteRepository) {}

  async execute(
    clienteId: string,
    userId: string,
    input: CreatePushBody,
  ): Promise<{ push: PushSubscription }> {
    const entity = new PushSubscription(
      {
        usuarioId: userId,
        clienteId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
      },
      {},
    );
    const created = await this.repository.createPush(entity);
    return { push: created };
  }
}
