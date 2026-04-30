import { Inject, Injectable, Logger } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';
import { Request } from 'express';
import { getAccessScope } from '@shared/security/access-scope.helpers';

import { EnfileirarScoreImovel } from '../../job/enfileirar-score-imovel';
import { CancelarReinspecoesAoFecharFoco } from '../../reinspecao/use-cases/cancelar-reinspecoes-ao-fechar-foco';
import {
  CriarReinspecaoPosTratamento,
  CriarReinspecaoResult,
} from '../../reinspecao/use-cases/criar-reinspecao-pos-tratamento';
import { FecharSlaAoResolverFoco } from '../../sla/use-cases/fechar-sla-ao-resolver-foco';
import {
  IniciarSlaAoConfirmarFoco,
  IniciarSlaResult,
} from '../../sla/use-cases/iniciar-sla-ao-confirmar-foco';
import { SlaWriteRepository } from '../../sla/repositories/sla-write.repository';
import { TransicionarFocoRiscoBody } from '../dtos/transicionar-foco-risco.body';
import { FocoRisco, FocoRiscoStatus } from '../entities/foco-risco';
import { FocoRiscoException } from '../errors/foco-risco.exception';
import { FocoRiscoReadRepository } from '../repositories/foco-risco-read.repository';
import { FocoRiscoWriteRepository } from '../repositories/foco-risco-write.repository';
import { RecalcularScorePrioridadeFoco } from './recalcular-score-prioridade-foco';

/**
 * Status terminais que fecham SLAs remanescentes do foco. Alinhado com o
 * `descartado` também fecha SLAs remanescentes (é o branch `confirmado: false`).
 */
const STATUS_FECHAMENTO: FocoRiscoStatus[] = ['resolvido', 'descartado'];

@Injectable()
export class TransicionarFocoRisco {
  private readonly logger = new Logger(TransicionarFocoRisco.name);

  constructor(
    private prisma: PrismaService,
    private readRepository: FocoRiscoReadRepository,
    private writeRepository: FocoRiscoWriteRepository,
    private iniciarSla: IniciarSlaAoConfirmarFoco,
    private fecharSla: FecharSlaAoResolverFoco,
    private slaWriteRepo: SlaWriteRepository,
    private criarReinspecao: CriarReinspecaoPosTratamento,
    private cancelarReinspecoes: CancelarReinspecoesAoFecharFoco,
    private recalcularScore: RecalcularScorePrioridadeFoco,
    private enfileirarScore: EnfileirarScoreImovel,
    @Inject(REQUEST) private req: Request,
  ) {}

  async execute(id: string, input: TransicionarFocoRiscoBody) {
    const tenantId = getAccessScope(this.req).tenantId;
    const foco = await this.readRepository.findById(id, tenantId);
    if (!foco) throw FocoRiscoException.notFound();

    const novoStatus = input.statusPara as FocoRiscoStatus;

    if (!foco.podeTransicionar(novoStatus)) {
      throw FocoRiscoException.transicaoInvalida();
    }

    const statusAnterior = foco.status;
    foco.status = novoStatus;

    // Timestamps específicos por estado
    if (novoStatus === 'confirmado') foco.confirmadoEm = new Date();
    if (STATUS_FECHAMENTO.includes(novoStatus)) {
      foco.resolvidoEm = new Date();
      if (input.desfecho) foco.desfecho = input.desfecho;
    }

    // ── Transação interativa: foco + SLA/reinspeção hooks + histórico atômicos
    // Se qualquer passo LEGÍTIMO (não SLA/reinspeção) lançar, rollback total.
    // Para SLA/reinspeção, capturamos erro em `slaError` e seguimos o fluxo —
    // a compensação (registro em `sla_erros_criacao`) roda FORA da tx.
    // `slaError` é nome histórico mas cobre ambas as trilhas de hook.
    let slaResult: IniciarSlaResult | null = null;
    let slaFechados: number | null = null;
    let reinspecaoResult: CriarReinspecaoResult | null = null;
    let reinspecoesCanceladas: number | null = null;
    let slaError: unknown = null;

    await this.prisma.client.$transaction(async (tx) => {
      await this.writeRepository.save(foco, tx);

      // Hook SLA + reinspeção:
      //   confirmado          → inicia SLA
      //   em_tratamento       → cria reinspeção pós-tratamento
      //   resolvido/descartado → fecha SLA + cancela reinspeções pendentes
      try {
        if (novoStatus === 'confirmado') {
          slaResult = await this.iniciarSla.execute(foco, tx);
        } else if (novoStatus === 'em_tratamento') {
          reinspecaoResult = await this.criarReinspecao.execute(foco, tx);
        } else if (STATUS_FECHAMENTO.includes(novoStatus) && foco.id) {
          slaFechados = await this.fecharSla.execute(foco.id, tx);
          reinspecoesCanceladas = await this.cancelarReinspecoes.execute(
            foco.id,
            this.req['user']?.id,
            tx,
          );
        }
      } catch (err) {
        // Compensação: NÃO relança. foco + histórico seguem salvos.
        slaError = err;
        this.logger.error(
          `Hook (sla/reinspecao) falhou em transição ${statusAnterior} → ${novoStatus} do foco ${foco.id}`,
          err instanceof Error ? err.stack : String(err),
        );
      }

      await this.writeRepository.createHistorico(
        {
          focoRiscoId: foco.id,
          clienteId: foco.clienteId,
          statusAnterior,
          statusNovo: novoStatus,
          alteradoPor: this.req['user']?.id,
          motivo: input.motivo,
          tipoEvento: 'mudanca_status',
        },
        tx,
      );
    });

    // ── Compensação fora da transação ──────────────────────────────────────
    // Registra o erro em sla_erros_criacao. O `.catch` é log-de-log:
    // se essa gravação também falhar, engolimos — não deve derrubar a request.
    if (slaError) {
      const msg = slaError instanceof Error ? slaError.message : String(slaError);
      this.slaWriteRepo
        .registrarErroCriacao({
          clienteId: foco.clienteId,
          focoRiscoId: foco.id ?? null,
          erro: msg,
          contexto: {
            use_case: 'TransicionarFocoRisco',
            status_anterior: statusAnterior,
            status_novo: novoStatus,
          },
        })
        .catch((logErr: unknown) => {
          this.logger.error(
            'Falha ao registrar sla_erros_criacao (log-de-log engolido)',
            logErr instanceof Error ? logErr.stack : String(logErr),
          );
        });
    }

    // Fase F.1.A — recalcula score após transição de status (best-effort)
    try {
      await this.recalcularScore.execute(foco.id!);
    } catch (err) {
      this.logger.error(
        `Hook RecalcularScorePrioridadeFoco falhou em transição → ${novoStatus} do foco ${foco.id}`,
        err instanceof Error ? err.stack : String(err),
      );
    }

    // Fase F.1.B — enfileira recálculo do score territorial do imóvel (best-effort)
    if (foco.imovelId) {
      try {
        await this.enfileirarScore.enfileirarPorImovel(foco.imovelId, foco.clienteId);
      } catch (err) {
        this.logger.error(
          `[TransicionarFocoRisco] Falha ao enfileirar score do imóvel ${foco.imovelId}: ${(err as Error).message}`,
          (err as Error).stack,
        );
      }
    }

    return {
      foco,
      sla: slaResult,
      slaFechados,
      reinspecao: reinspecaoResult,
      reinspecoesCanceladas,
      slaError: slaError ? String(slaError) : null,
    };
  }

}
