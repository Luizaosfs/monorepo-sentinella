import { Injectable } from '@nestjs/common';

import { SaveCasoBody } from '../dtos/create-notificacao.body';
import { CasoNotificado } from '../entities/notificacao';
import { NotificacaoException } from '../errors/notificacao.exception';
import { NotificacaoReadRepository } from '../repositories/notificacao-read.repository';
import { NotificacaoWriteRepository } from '../repositories/notificacao-write.repository';

@Injectable()
export class SaveCaso {
  constructor(
    private readRepository: NotificacaoReadRepository,
    private writeRepository: NotificacaoWriteRepository,
  ) {}

  async execute(id: string, input: SaveCasoBody): Promise<{ caso: CasoNotificado }> {
    const caso = await this.readRepository.findCasoById(id);
    if (!caso) throw NotificacaoException.casoNotFound();

    if (input.doenca !== undefined) caso.doenca = input.doenca;
    if (input.status !== undefined) caso.status = input.status;
    if (input.dataInicioSintomas !== undefined) caso.dataInicioSintomas = input.dataInicioSintomas;
    if (input.logradouroBairro !== undefined) caso.logradouroBairro = input.logradouroBairro;
    if (input.bairro !== undefined) caso.bairro = input.bairro;
    if (input.latitude !== undefined) caso.latitude = input.latitude;
    if (input.longitude !== undefined) caso.longitude = input.longitude;
    if (input.regiaoId !== undefined) caso.regiaoId = input.regiaoId;
    if (input.observacao !== undefined) caso.observacao = input.observacao;

    await this.writeRepository.saveCaso(caso);
    return { caso };
  }
}
