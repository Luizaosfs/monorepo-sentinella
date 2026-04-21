import { Injectable } from '@nestjs/common';

import { FocoRisco } from '../../foco-risco/entities/foco-risco';
import { SlaReadRepository } from '../repositories/sla-read.repository';
import { SlaWriteRepository } from '../repositories/sla-write.repository';
import { ResolveSlaConfig } from './resolve-sla-config';

export type IniciarSlaAcao =
  | 'ja_existente'
  | 'vinculado'
  | 'criado'
  | 'nao_criado';

export interface IniciarSlaResult {
  acao: IniciarSlaAcao;
  slaId?: string;
  vinculados?: number;
  fromFallback?: boolean;
}

/**
 * Porte de `fn_iniciar_sla_ao_confirmar_foco` + `fn_vincular_sla_ao_confirmar`
 * do Supabase legado (dois triggers que viravam um efeito só quando o foco
 * transitava para `confirmado`).
 *
 * Ordem de operação:
 *   1. **Idempotência** — se já existe SLA para este foco, retorna sem mexer.
 *   2. **Vincular órfão** — se o foco tem `origem_levantamento_item_id` e
 *      existe um SLA criado pela geração em bulk (`gerar-slas-run`) sem
 *      `foco_risco_id`, faz o pareamento (UPDATE sla.foco_risco_id).
 *   3. **Resolve config** — via `ResolveSlaConfig` (região → cliente → fallback).
 *   4. **Calcula prazo** — `inicio = now()`, `prazoFinal = inicio + slaHoras`.
 *   5. **Cria SLA novo** — se não houve vínculo no passo 2.
 *
 * Precisa rodar dentro do `$transaction(callback)` do Transicionar — o `tx?`
 * parameter repassa o client transacional para os métodos de repo.
 */
@Injectable()
export class IniciarSlaAoConfirmarFoco {
  constructor(
    private readRepo: SlaReadRepository,
    private writeRepo: SlaWriteRepository,
    private resolveSlaConfig: ResolveSlaConfig,
  ) {}

  async execute(foco: FocoRisco, tx?: unknown): Promise<IniciarSlaResult> {
    const focoId = foco.id;
    if (!focoId) {
      // Foco persistido SEMPRE tem id — este branch é defensivo.
      return { acao: 'nao_criado' };
    }

    // 1. Idempotência — nenhum efeito se já existir SLA para o foco.
    const existente = await this.readRepo.findByFocoRiscoId(focoId, tx);
    if (existente) {
      return { acao: 'ja_existente', slaId: existente.id };
    }

    // 2. Vincular SLA órfão criado pelo fluxo de bulk em `pluvio/gerar-slas-run`.
    if (foco.origemLevantamentoItemId) {
      const vinculados = await this.writeRepo.vincularAFoco(
        focoId,
        foco.origemLevantamentoItemId,
        tx,
      );
      if (vinculados > 0) {
        const vinculado = await this.readRepo.findByFocoRiscoId(focoId, tx);
        return {
          acao: 'vinculado',
          slaId: vinculado?.id,
          vinculados,
        };
      }
    }

    // 3. Resolve config (região → cliente → fallback).
    const prioridade = foco.prioridade ?? 'P3';
    const resolved = await this.resolveSlaConfig.execute({
      clienteId: foco.clienteId,
      regiaoId: foco.regiaoId ?? null,
      prioridade,
    });

    // 4. Calcula prazo.
    const inicio = new Date();
    const prazoFinal = new Date(
      inicio.getTime() + resolved.slaHoras * 60 * 60 * 1000,
    );

    // 5. Cria SLA.
    const created = await this.writeRepo.createFromFoco(
      {
        clienteId: foco.clienteId,
        focoRiscoId: focoId,
        levantamentoItemId: foco.origemLevantamentoItemId ?? null,
        prioridade,
        slaHoras: resolved.slaHoras,
        inicio,
        prazoFinal,
      },
      tx,
    );

    if (created.conflicted) {
      // Race condition: alguém criou em paralelo — devolve estado consistente.
      const final = await this.readRepo.findByFocoRiscoId(focoId, tx);
      return { acao: 'ja_existente', slaId: final?.id };
    }

    return {
      acao: 'criado',
      slaId: created.id,
      fromFallback: resolved.fromFallback,
    };
  }
}
