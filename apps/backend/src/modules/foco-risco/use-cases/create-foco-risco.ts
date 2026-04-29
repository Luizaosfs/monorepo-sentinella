import { Inject, Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { getAccessScope, requireTenantId } from '@shared/security/access-scope.helpers';

import { EnfileirarScoreImovel } from '../../job/enfileirar-score-imovel';
import { CreateFocoRiscoBody } from '../dtos/create-foco-risco.body';
import { FocoRisco } from '../entities/foco-risco';
import { FocoRiscoWriteRepository } from '../repositories/foco-risco-write.repository';
import { autoClassificarFoco } from './auto-criacao/auto-classificar-foco';
import { CruzarFocoNovoComCasos } from './cruzar-foco-novo-com-casos';
import { elevarPrioridadeRecorrencia } from './helpers/elevar-prioridade-recorrencia';
import { NormalizarCicloFoco } from './normalizar-ciclo-foco';
import { RecalcularScorePrioridadeFoco } from './recalcular-score-prioridade-foco';

@Injectable()
export class CreateFocoRisco {
  private readonly logger = new Logger(CreateFocoRisco.name);

  constructor(
    private repository: FocoRiscoWriteRepository,
    private cruzarFocoNovoComCasos: CruzarFocoNovoComCasos,
    private recalcularScore: RecalcularScorePrioridadeFoco,
    private enfileirarScore: EnfileirarScoreImovel,
    private normalizarCicloFoco: NormalizarCicloFoco,
    @Inject('REQUEST') private req: Request,
  ) {}

  async execute(input: CreateFocoRiscoBody) {
    const clienteId = requireTenantId(getAccessScope(this.req));
    const ciclo = await this.normalizarCicloFoco.execute(clienteId);

    // K.1 — fn_elevar_prioridade_recorrencia: recorrência eleva prioridade um nível
    const prioridade = input.focoAnteriorId != null
      ? elevarPrioridadeRecorrencia(input.prioridade)
      : input.prioridade;

    const foco = new FocoRisco(
      {
        clienteId,
        imovelId: input.imovelId,
        regiaoId: input.regiaoId,
        origemTipo: input.origemTipo,
        origemLevantamentoItemId: input.origemLevantamentoItemId,
        origemVistoriaId: input.origemVistoriaId,
        ciclo,
        status: 'suspeita',
        prioridade,
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

    // Fase F.1.A — score de prioridade inicial (best-effort)
    try {
      await this.recalcularScore.execute(created.id!);
    } catch (err) {
      this.logger.error(
        `Hook RecalcularScorePrioridadeFoco falhou para foco ${created.id}: ${(err as Error).message}`,
      );
    }

    // Fase F.1.B — enfileira recálculo do score territorial do imóvel (best-effort)
    if (created.imovelId) {
      try {
        await this.enfileirarScore.enfileirarPorImovel(created.imovelId, created.clienteId);
      } catch (err) {
        this.logger.error(
          `[CreateFocoRisco] Falha ao enfileirar score do imóvel ${created.imovelId}: ${(err as Error).message}`,
          (err as Error).stack,
        );
      }
    }

    return { foco: created };
  }
}
