import { Injectable, Logger } from '@nestjs/common';

import { BillingReadRepository, MetricaContagem } from '../repositories/billing-read.repository';

export type Metrica =
  | 'voos_mes'
  | 'levantamentos_mes'
  | 'itens_mes'
  | 'vistorias_mes'
  | 'usuarios_ativos'
  | 'ia_calls_mes'
  | 'storage_gb';

export interface VerificarQuotaResult {
  ok: boolean;
  usado: number;
  limite: number | null;
  motivo?: 'tenant_bloqueado' | 'excedido' | 'fail_safe';
}

@Injectable()
export class VerificarQuota {
  private readonly logger = new Logger(VerificarQuota.name);

  constructor(private readRepository: BillingReadRepository) {}

  async execute(
    clienteId: string,
    input: { metrica: Metrica },
  ): Promise<VerificarQuotaResult> {
    try {
      const metrica = input.metrica;

      // Placeholders — not implemented in this phase
      if (metrica === 'ia_calls_mes' || metrica === 'storage_gb') {
        return { ok: true, usado: 0, limite: null };
      }

      // Step 0: check tenant status
      const clientePlano = await this.readRepository.findClientePlano(clienteId);
      if (clientePlano) {
        const { status, dataTrialFim } = clientePlano;
        if (
          status === 'suspenso' ||
          status === 'cancelado' ||
          (status === 'trial' && dataTrialFim != null && dataTrialFim < new Date())
        ) {
          return { ok: false, usado: 0, limite: 0, motivo: 'tenant_bloqueado' };
        }
      }

      // Step 1: resolve limit via COALESCE(override em cliente_quotas, limite do plano)
      const [quotas, plano] = await Promise.all([
        this.readRepository.findQuotas(clienteId),
        clientePlano?.planoId
          ? this.readRepository.findPlanoById(clientePlano.planoId)
          : Promise.resolve(null),
      ]);

      const metr = metrica as MetricaContagem;

      const overrideMap: Record<MetricaContagem, number | null | undefined> = {
        voos_mes: quotas?.voosMes,
        levantamentos_mes: quotas?.levantamentosMes,
        itens_mes: quotas?.itensMes,
        vistorias_mes: quotas?.vistoriasMes,
        usuarios_ativos: quotas?.usuariosAtivos,
      };

      // itens_mes has no corresponding field in planos — override only
      const planoLimiteMap: Record<MetricaContagem, number | null | undefined> = {
        voos_mes: plano?.limiteVoosMes,
        levantamentos_mes: plano?.limiteLevantamentosMes,
        itens_mes: undefined,
        vistorias_mes: plano?.limiteVistoriasMes,
        usuarios_ativos: plano?.limiteUsuarios,
      };

      const limite: number | null = overrideMap[metr] ?? planoLimiteMap[metr] ?? null;

      // Step 2: count actual usage with TZ-correct queries
      const usado = await this.readRepository.findContagemMetrica(clienteId, metr);

      // Step 3: result — blocks at limit (used >= limit), paridade com trigger SQL
      const excedido = limite !== null && usado >= limite;
      return {
        ok: !excedido,
        usado,
        limite,
        motivo: excedido ? 'excedido' : undefined,
      };
    } catch (err) {
      this.logger.error(
        `[VerificarQuota] fail_safe: ${(err as Error).message}`,
        (err as Error).stack,
      );
      return { ok: true, usado: 0, limite: null, motivo: 'fail_safe' };
    }
  }
}
