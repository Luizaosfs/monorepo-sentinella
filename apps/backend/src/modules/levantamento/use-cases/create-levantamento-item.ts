import { Injectable } from '@nestjs/common';

import { CreateLevantamentoItemBody } from '../dtos/create-levantamento-item.body';
import { LevantamentoException } from '../errors/levantamento.exception';
import { LevantamentoReadRepository } from '../repositories/levantamento-read.repository';
import { LevantamentoWriteRepository } from '../repositories/levantamento-write.repository';

@Injectable()
export class CreateLevantamentoItem {
  constructor(
    private readRepository: LevantamentoReadRepository,
    private writeRepository: LevantamentoWriteRepository,
  ) {}

  async execute(levantamentoId: string, input: CreateLevantamentoItemBody) {
    const levantamento = await this.readRepository.findById(levantamentoId);
    if (!levantamento) throw LevantamentoException.notFound();

    const item = await this.writeRepository.createItem({
      levantamentoId,
      latitude: input.latitude,
      longitude: input.longitude,
      item: input.item,
      risco: input.risco,
      acao: input.acao,
      scoreFinal: input.scoreFinal,
      prioridade: input.prioridade,
      slaHoras: input.slaHoras,
      enderecoCurto: input.enderecoCurto,
      enderecoCompleto: input.enderecoCompleto,
      imageUrl: input.imageUrl,
      maps: input.maps,
      waze: input.waze,
      dataHora: input.dataHora,
      peso: input.peso,
      payload: input.payload,
      imagePublicId: input.imagePublicId,
    });

    return { item };
  }
}
