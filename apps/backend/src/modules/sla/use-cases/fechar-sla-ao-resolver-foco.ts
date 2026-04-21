import { Injectable } from '@nestjs/common';

import { SlaWriteRepository } from '../repositories/sla-write.repository';

/**
 * Porte de `fn_fechar_sla_ao_resolver_foco` do Supabase legado.
 *
 * Dispara quando o foco transita para `resolvido` ou `descartado` — qualquer
 * SLA ainda pendente/em_atendimento vinculado a ele é fechado em lote.
 *
 * Idempotente (UPDATE filtrado por status IN ('pendente','em_atendimento')) —
 * disparar 2x não re-fecha nada. Retorna quantos fechou.
 */
@Injectable()
export class FecharSlaAoResolverFoco {
  constructor(private writeRepo: SlaWriteRepository) {}

  execute(focoRiscoId: string, tx?: unknown): Promise<number> {
    return this.writeRepo.fecharTodosPorFoco(focoRiscoId, tx);
  }
}
