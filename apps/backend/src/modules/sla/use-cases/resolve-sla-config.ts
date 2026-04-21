import { Injectable, Logger } from '@nestjs/common';
import type { JsonObject } from '@shared/types/json';

import { SlaReadRepository } from '../repositories/sla-read.repository';

/**
 * Fallback canônico (em horas). Alinhado com `sla_resolve_config` do Supabase
 * legado. P3=24h é o default quando `prioridade` cai fora do range ou quando
 * o JSON de config não declara aquele nível.
 */
const FALLBACK_HOURS: Record<string, number> = {
  P1: 4,
  P2: 12,
  P3: 24,
  P4: 72,
  P5: 168,
};

export interface ResolveSlaConfigInput {
  clienteId: string;
  regiaoId?: string | null;
  prioridade: string;
}

export interface ResolveSlaConfigResult {
  slaHoras: number;
  fromFallback: boolean;
  source: 'regiao' | 'cliente' | 'fallback';
}

/**
 * Porte de `public.sla_resolve_config(cliente_id, regiao_id, prioridade)`.
 *
 * Ordem de resolução (primeiro que casar vence):
 *   1. `sla_config_regiao` (se `regiaoId` informado) → `config[prioridade]`
 *   2. `sla_config` do cliente → `config[prioridade]`
 *   3. Fallback hard-coded (com `Logger.warn` para rastrear "órfãos" de config)
 *
 * O resolver é **fail-safe**: qualquer config malformada (não-numérico,
 * negativo, zero) é ignorada silenciosamente — cai para o próximo nível.
 * Aceita string numérica (legado importado tem valores tipo `"4"`).
 */
@Injectable()
export class ResolveSlaConfig {
  private readonly logger = new Logger(ResolveSlaConfig.name);

  constructor(private readRepo: SlaReadRepository) {}

  async execute(input: ResolveSlaConfigInput): Promise<ResolveSlaConfigResult> {
    const { clienteId, regiaoId, prioridade } = input;

    // 1. config regional
    if (regiaoId) {
      const regiao = await this.readRepo.findConfigByRegiao(
        clienteId,
        regiaoId,
      );
      const fromRegiao = this.tryExtract(regiao?.config, prioridade);
      if (fromRegiao !== null) {
        return { slaHoras: fromRegiao, fromFallback: false, source: 'regiao' };
      }
    }

    // 2. config do cliente
    const cliente = await this.readRepo.findConfig(clienteId);
    const fromCliente = this.tryExtract(cliente?.config, prioridade);
    if (fromCliente !== null) {
      return { slaHoras: fromCliente, fromFallback: false, source: 'cliente' };
    }

    // 3. fallback + warn (visibilidade operacional de config ausente)
    const fallback = FALLBACK_HOURS[prioridade] ?? FALLBACK_HOURS.P3;
    this.logger.warn(
      `SLA config ausente para cliente=${clienteId} regiao=${regiaoId ?? 'n/a'} prioridade=${prioridade} → fallback ${fallback}h`,
    );
    return { slaHoras: fallback, fromFallback: true, source: 'fallback' };
  }

  /**
   * Extrai `config[prioridade]` como horas. Aceita number ou string numérica.
   * Retorna `null` se ausente, inválido, negativo ou zero.
   */
  private tryExtract(
    config: JsonObject | null | undefined,
    prioridade: string,
  ): number | null {
    if (!config || typeof config !== 'object') return null;
    const raw = (config as Record<string, unknown>)[prioridade];
    return this.tryParse(raw);
  }

  private tryParse(raw: unknown): number | null {
    if (raw == null) return null;
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  }
}
