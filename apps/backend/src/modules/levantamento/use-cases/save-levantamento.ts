import { Injectable } from '@nestjs/common';

import { SaveLevantamentoBody } from '../dtos/save-levantamento.body';
import { LevantamentoException } from '../errors/levantamento.exception';
import { LevantamentoReadRepository } from '../repositories/levantamento-read.repository';
import { LevantamentoWriteRepository } from '../repositories/levantamento-write.repository';

@Injectable()
export class SaveLevantamento {
  constructor(
    private readRepository: LevantamentoReadRepository,
    private writeRepository: LevantamentoWriteRepository,
  ) {}

  async execute(id: string, input: SaveLevantamentoBody) {
    const levantamento = await this.readRepository.findById(id);
    if (!levantamento) throw LevantamentoException.notFound();

    if (input.planejamentoId !== undefined) levantamento.planejamentoId = input.planejamentoId;
    if (input.cicloId !== undefined) levantamento.cicloId = input.cicloId;
    if (input.usuarioId !== undefined) levantamento.usuarioId = input.usuarioId;
    if (input.titulo !== undefined) levantamento.titulo = input.titulo;
    if (input.tipoEntrada !== undefined) levantamento.tipoEntrada = input.tipoEntrada;
    if (input.statusProcessamento !== undefined)
      levantamento.statusProcessamento = input.statusProcessamento;
    if (input.observacao !== undefined) levantamento.observacao = input.observacao;
    if (input.concluidoEm !== undefined)
      levantamento.concluidoEm = input.concluidoEm as Date | undefined;

    await this.writeRepository.save(levantamento);
    return { levantamento };
  }
}
