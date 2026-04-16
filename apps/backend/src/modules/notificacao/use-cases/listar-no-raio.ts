import { Injectable } from '@nestjs/common';

import { CasoNotificado } from '../entities/notificacao';
import { NotificacaoReadRepository } from '../repositories/notificacao-read.repository';

@Injectable()
export class ListarNoRaio {
  constructor(private readRepository: NotificacaoReadRepository) {}

  async execute(
    lat: number,
    lng: number,
    raioMetros: number,
    clienteId: string,
  ): Promise<{ items: CasoNotificado[] }> {
    const items = await this.readRepository.findCasosNoRaio(lat, lng, raioMetros, clienteId);
    return { items };
  }
}
