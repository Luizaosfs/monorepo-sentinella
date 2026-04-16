import { Injectable } from '@nestjs/common';

import { SavePlanejamentoBody } from '../dtos/save-planejamento.body';
import { PlanejamentoException } from '../errors/planejamento.exception';
import { PlanejamentoReadRepository } from '../repositories/planejamento-read.repository';
import { PlanejamentoWriteRepository } from '../repositories/planejamento-write.repository';

@Injectable()
export class SavePlanejamento {
  constructor(
    private readRepository: PlanejamentoReadRepository,
    private writeRepository: PlanejamentoWriteRepository,
  ) {}

  async execute(id: string, data: SavePlanejamentoBody) {
    const planejamento = await this.readRepository.findById(id);
    if (!planejamento) throw PlanejamentoException.notFound();

    if (data.descricao !== undefined) planejamento.descricao = data.descricao;
    if (data.dataPlanejamento !== undefined)
      planejamento.dataPlanejamento = data.dataPlanejamento;
    if (data.areaTotal !== undefined) planejamento.areaTotal = data.areaTotal;
    if (data.alturaVoo !== undefined) planejamento.alturaVoo = data.alturaVoo;
    if (data.tipo !== undefined) planejamento.tipo = data.tipo;
    if (data.ativo !== undefined) planejamento.ativo = data.ativo;
    if (data.tipoEntrada !== undefined)
      planejamento.tipoEntrada = data.tipoEntrada;
    if (data.tipoLevantamento !== undefined)
      planejamento.tipoLevantamento = data.tipoLevantamento;
    if (data.regiaoId !== undefined) planejamento.regiaoId = data.regiaoId;

    await this.writeRepository.save(planejamento);
    return { planejamento };
  }
}
