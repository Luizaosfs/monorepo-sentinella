import { Injectable } from '@nestjs/common';

import { CreateUnidadeBody } from '../dtos/create-notificacao.body';
import { UnidadeSaude } from '../entities/notificacao';
import { NotificacaoWriteRepository } from '../repositories/notificacao-write.repository';

@Injectable()
export class CreateUnidade {
  constructor(private repository: NotificacaoWriteRepository) {}

  async execute(clienteId: string, input: CreateUnidadeBody): Promise<{ unidade: UnidadeSaude }> {
    const entity = new UnidadeSaude(
      {
        clienteId,
        nome: input.nome,
        tipo: input.tipo ?? 'ubs',
        endereco: input.endereco,
        latitude: input.latitude,
        longitude: input.longitude,
        ativo: input.ativo ?? true,
        cnes: input.cnes,
        tipoSentinela: input.tipoSentinela ?? 'OUTRO',
        telefone: input.telefone,
        bairro: input.bairro,
        municipio: input.municipio,
        uf: input.uf,
        origem: input.origem ?? 'manual',
      },
      {},
    );
    const created = await this.repository.createUnidade(entity);
    return { unidade: created };
  }
}
