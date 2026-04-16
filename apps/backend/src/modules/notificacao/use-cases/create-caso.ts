import { Injectable } from '@nestjs/common';

import { CreateCasoBody } from '../dtos/create-notificacao.body';
import { CasoNotificado } from '../entities/notificacao';
import { NotificacaoWriteRepository } from '../repositories/notificacao-write.repository';

@Injectable()
export class CreateCaso {
  constructor(private repository: NotificacaoWriteRepository) {}

  async execute(
    clienteId: string,
    userId: string | undefined,
    input: CreateCasoBody,
  ): Promise<{ caso: CasoNotificado }> {
    const entity = new CasoNotificado(
      {
        clienteId,
        unidadeSaudeId: input.unidadeSaudeId,
        notificadorId: userId,
        doenca: input.doenca ?? 'suspeito',
        status: input.status ?? 'suspeito',
        dataInicioSintomas: input.dataInicioSintomas,
        dataNotificacao: input.dataNotificacao ?? new Date(),
        logradouroBairro: input.logradouroBairro,
        bairro: input.bairro,
        latitude: input.latitude,
        longitude: input.longitude,
        regiaoId: input.regiaoId,
        observacao: input.observacao,
        payload: input.payload,
        createdBy: userId,
      },
      {},
    );
    const created = await this.repository.createCaso(entity);
    return { caso: created };
  }
}
