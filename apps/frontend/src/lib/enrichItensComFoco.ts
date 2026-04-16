import type { LevantamentoItem, FocoRiscoStatus, StatusAtendimento } from '@/types/database';
import { mapFocoToStatusOperacional, type FocoStatus } from '@/lib/mapStatusOperacional';

/**
 * Converte status de focos_risco para o campo virtual status_atendimento de LevantamentoItem.
 * Mantém compatibilidade com código legado que lê status_atendimento.
 * Delega à função centralizada em mapStatusOperacional.ts.
 */
export function mapFocoStatusToAtendimento(status?: string | null): StatusAtendimento {
  const s = String(status ?? '').toLowerCase();
  if (s === 'cancelado') return 'resolvido'; // valor legado não mapeado no tipo FocoStatus
  return mapFocoToStatusOperacional(s as FocoStatus);
}

/**
 * Injeta campos virtuais de focos_risco em rows de levantamento_itens.
 * A coluna status_atendimento foi removida em 20260711000000 — estes campos
 * são reconstruídos a partir do join com focos_risco (alias "foco").
 */
export function enrichItensComFoco(rows: Array<Record<string, unknown>>): LevantamentoItem[] {
  return rows.map((row) => {
    const focoRaw = row.foco as Record<string, unknown> | Array<Record<string, unknown>> | null;
    const foco = Array.isArray(focoRaw) ? (focoRaw[0] ?? null) : focoRaw;
    return {
      ...(row as unknown as LevantamentoItem),
      foco_risco_id: (foco?.id as string | undefined) ?? null,
      foco_risco_status: (foco?.status as FocoRiscoStatus | undefined) ?? null,
      status_atendimento: mapFocoStatusToAtendimento((foco?.status as string | undefined) ?? null),
      acao_aplicada: (foco?.desfecho as string | null) ?? null,
      data_resolucao: (foco?.resolvido_em as string | null) ?? null,
      codigo_foco: (foco?.codigo_foco as string | null) ?? null,
    } as LevantamentoItem;
  });
}
