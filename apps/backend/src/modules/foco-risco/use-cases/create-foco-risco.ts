import { Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';

import { CreateFocoRiscoBody } from '../dtos/create-foco-risco.body';
import { FocoRisco } from '../entities/foco-risco';
import { FocoRiscoWriteRepository } from '../repositories/foco-risco-write.repository';

@Injectable()
export class CreateFocoRisco {
  constructor(
    private repository: FocoRiscoWriteRepository,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(input: CreateFocoRiscoBody) {
    const foco = new FocoRisco(
      {
        clienteId: this.req['tenantId'],
        imovelId: input.imovelId,
        regiaoId: input.regiaoId,
        origemTipo: input.origemTipo,
        origemLevantamentoItemId: input.origemLevantamentoItemId,
        origemVistoriaId: input.origemVistoriaId,
        status: 'suspeita',
        prioridade: input.prioridade,
        latitude: input.latitude,
        longitude: input.longitude,
        enderecoNormalizado: input.enderecoNormalizado,
        suspeitaEm: new Date(),
        responsavelId: input.responsavelId,
        focoAnteriorId: input.focoAnteriorId,
        casosIds: [],
        observacao: input.observacao,
        classificacaoInicial: input.classificacaoInicial ?? 'suspeito',
        scorePrioridade: 0,
      },
      { createdBy: this.req['user']?.id },
    );

    const created = await this.repository.create(foco);

    // Registra histórico de criação
    await this.repository.createHistorico({
      focoRiscoId: created.id,
      clienteId: created.clienteId,
      statusNovo: 'suspeita',
      alteradoPor: this.req['user']?.id,
      motivo: 'Foco criado',
      tipoEvento: 'criacao',
      classificacaoNova: created.classificacaoInicial,
    });

    return { foco: created };
  }
}
