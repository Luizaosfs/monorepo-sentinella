import { Inject, Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';

import { CreateFocoRiscoBody } from '../dtos/create-foco-risco.body';
import { FocoRisco } from '../entities/foco-risco';
import { FocoRiscoWriteRepository } from '../repositories/foco-risco-write.repository';
import { autoClassificarFoco } from './auto-criacao/auto-classificar-foco';
import { CruzarFocoNovoComCasos } from './cruzar-foco-novo-com-casos';

@Injectable()
export class CreateFocoRisco {
  private readonly logger = new Logger(CreateFocoRisco.name);

  constructor(
    private repository: FocoRiscoWriteRepository,
    private cruzarFocoNovoComCasos: CruzarFocoNovoComCasos,
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
        classificacaoInicial: autoClassificarFoco({
          origemTipo: input.origemTipo,
          classificacaoInicial: input.classificacaoInicial,
        }),
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

    // Fase C.4 — hook best-effort. Falha no cruzamento NÃO quebra a criação.
    try {
      await this.cruzarFocoNovoComCasos.execute({
        focoId: created.id,
        clienteId: created.clienteId,
        origemLevantamentoItemId: created.origemLevantamentoItemId,
        latitude: created.latitude,
        longitude: created.longitude,
      });
    } catch (err) {
      this.logger.error(
        `Hook CruzarFocoNovoComCasos falhou para foco ${created.id}: ${(err as Error).message}`,
      );
    }

    return { foco: created };
  }
}
