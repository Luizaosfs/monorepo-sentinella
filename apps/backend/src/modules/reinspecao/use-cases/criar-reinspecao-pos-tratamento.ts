import { FocoRisco } from '@modules/foco-risco/entities/foco-risco';
import { Injectable, Logger } from '@nestjs/common';

import { Reinspecao } from '../entities/reinspecao';
import { ReinspecaoReadRepository } from '../repositories/reinspecao-read.repository';
import { ReinspecaoWriteRepository } from '../repositories/reinspecao-write.repository';

export type CriarReinspecaoAcao = 'criada' | 'ja_existente' | 'nao_criada';

export interface CriarReinspecaoResult {
  acao: CriarReinspecaoAcao;
  reinspecaoId?: string;
  dataPrevista?: Date;
}

/**
 * Cria uma reinspeção PENDENTE do tipo `eficacia_pos_tratamento` quando o foco
 * transita para `em_tratamento`. Invocado dentro do `$transaction(callback)`
 * do `TransicionarFocoRisco`.
 *
 * Regras portadas literalmente do trigger SQL:
 *   - Somente quando o foco entra em `em_tratamento` (a chamada já garante
 *     este filtro no uso-case chamador).
 *   - `data_prevista = now() + 7 dias` (janela de eficácia do tratamento).
 *   - Idempotência: se já existe reinspeção pendente do mesmo tipo para este
 *     foco, retorna sem criar. O schema atual NÃO possui unique partial index
 *     equivalente ao Supabase, então a proteção é em software (findFirst).
 *   - Origem fixa: `automatico` (paridade com trigger SQL legado e tipo
 *     literal `'automatico' | 'manual'` do frontend). O `CriarManual` usa
 *     `'manual'` — esses são os 2 valores canônicos.
 */
const DIAS_ATE_REINSPECAO = 7;
const TIPO_REINSPECAO = 'eficacia_pos_tratamento';
const ORIGEM_REINSPECAO = 'automatico';

@Injectable()
export class CriarReinspecaoPosTratamento {
  private readonly logger = new Logger(CriarReinspecaoPosTratamento.name);

  constructor(
    private readRepo: ReinspecaoReadRepository,
    private writeRepo: ReinspecaoWriteRepository,
  ) {}

  async execute(
    foco: FocoRisco,
    tx?: unknown,
  ): Promise<CriarReinspecaoResult> {
    const focoId = foco.id;
    if (!focoId) {
      // Foco persistido sempre tem id — branch defensivo.
      return { acao: 'nao_criada' };
    }

    // Idempotência: já existe reinspeção pendente deste tipo?
    const existente = await this.readRepo.findPendenteByFocoETipo(
      focoId,
      TIPO_REINSPECAO,
      tx,
    );
    if (existente) {
      return { acao: 'ja_existente', reinspecaoId: existente.id };
    }

    const dataPrevista = new Date();
    dataPrevista.setUTCDate(dataPrevista.getUTCDate() + DIAS_ATE_REINSPECAO);

    const entity = new Reinspecao(
      {
        clienteId: foco.clienteId,
        focoRiscoId: focoId,
        status: 'pendente',
        tipo: TIPO_REINSPECAO,
        origem: ORIGEM_REINSPECAO,
        dataPrevista,
      },
      {},
    );

    const created = await this.writeRepo.createWithTx(entity, tx);
    this.logger.log(
      `Reinspeção pós-tratamento criada: foco=${focoId} reinspecao=${created.id} prevista=${dataPrevista.toISOString()}`,
    );

    return {
      acao: 'criada',
      reinspecaoId: created.id,
      dataPrevista,
    };
  }
}
