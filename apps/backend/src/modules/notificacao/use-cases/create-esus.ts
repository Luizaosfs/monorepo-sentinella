import { Injectable } from '@nestjs/common';

import { CreateEsusBody } from '../dtos/create-notificacao.body';
import { ItemNotificacaoEsus } from '../entities/notificacao';
import { NotificacaoWriteRepository } from '../repositories/notificacao-write.repository';

@Injectable()
export class CreateEsus {
  constructor(private repository: NotificacaoWriteRepository) {}

  async execute(
    clienteId: string,
    userId: string | undefined,
    input: CreateEsusBody,
  ): Promise<{ esus: ItemNotificacaoEsus }> {
    const entity = new ItemNotificacaoEsus(
      {
        clienteId,
        levantamentoItemId: input.levantamentoItemId,
        tipoAgravo: input.tipoAgravo,
        numeroNotificacao: input.numeroNotificacao,
        status: 'pendente',
        payloadEnviado: input.payloadEnviado,
        enviadoPor: userId,
      },
      {},
    );
    const created = await this.repository.createEsus(entity);
    return { esus: created };
  }
}
