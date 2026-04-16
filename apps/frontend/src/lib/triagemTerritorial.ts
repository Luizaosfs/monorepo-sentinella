/**
 * triagemTerritorial — lógica de agrupamento territorial de focos.
 *
 * A hierarquia é:
 *   1. quadra  — campo quarteirao do imóvel
 *   2. bairro  — campo bairro do imóvel
 *   3. regiao  — campo regiao_nome da região vinculada ao foco
 *   4. item    — fallback: foco individual (sempre disponível)
 *
 * Esta lógica é espelhada no banco em v_focos_risco_agrupados.
 * Manter sincronizado com a migration 20270102000000_p2_triagem_territorial.sql
 */

import type { FocoAgrupadorTipo } from '@/types/database';
import type { FocoRiscoStatus } from '@/types/database';

export interface AgrupadorInput {
  id: string;
  quarteirao?: string | null;
  bairro?: string | null;
  regiao_nome?: string | null;
}

export interface Agrupador {
  tipo: FocoAgrupadorTipo;
  valor: string;
}

/** Determina o tipo e valor do agrupamento territorial de um foco. */
export function resolveAgrupador(foco: AgrupadorInput): Agrupador {
  if (foco.quarteirao?.trim()) {
    return { tipo: 'quadra', valor: foco.quarteirao.trim() };
  }
  if (foco.bairro?.trim()) {
    return { tipo: 'bairro', valor: foco.bairro.trim() };
  }
  if (foco.regiao_nome?.trim()) {
    return { tipo: 'regiao', valor: foco.regiao_nome.trim() };
  }
  return { tipo: 'item', valor: foco.id };
}

/** Retorna true se o status permite distribuição (atribuição/reatribuição). */
export function isElegivelParaAtribuicao(status: FocoRiscoStatus): boolean {
  return status === 'em_triagem' || status === 'aguarda_inspecao';
}

/** Ordinal de prioridade: P1=1 (máxima) … P5=5 (mínima). Null/indefinido = 99. */
export function prioridadeOrdinal(prioridade?: string | null): number {
  switch (prioridade) {
    case 'P1': return 1;
    case 'P2': return 2;
    case 'P3': return 3;
    case 'P4': return 4;
    case 'P5': return 5;
    default:   return 99;
  }
}

/** Converte ordinal de volta para label (ex.: 1 → 'P1'). */
export function ordinalToPrioridade(ord: number | null): string | null {
  if (ord == null || ord >= 99) return null;
  return `P${ord}`;
}

/** Label legível do tipo de agrupamento. */
export const LABEL_AGRUPADOR: Record<FocoAgrupadorTipo, string> = {
  quadra:  'Quadra',
  bairro:  'Bairro',
  regiao:  'Região',
  item:    'Individual',
};

// ── Filtros de grupos ─────────────────────────────────────────────────────────

import type { FocoRiscoAgrupado } from '@/types/database';

export interface FiltrosTerritorial {
  /** Ordinal máximo de prioridade a exibir (1=P1 … 5=P5). null = sem filtro. */
  prioridadeMaxOrd: number | null;
  /** Exibir apenas grupos com ao menos 1 foco elegível para distribuição. */
  somenteElegiveis: boolean;
  /** Exibir apenas grupos com ao menos 1 foco sem responsável. */
  somentesSemResponsavel?: boolean;
}

/** Filtra lista de grupos conforme os filtros do modo territorial. */
export function filtrarGrupos(
  grupos: FocoRiscoAgrupado[],
  filtros: FiltrosTerritorial,
): FocoRiscoAgrupado[] {
  let result = grupos;

  if (filtros.prioridadeMaxOrd !== null) {
    result = result.filter(
      (g) => (g.prioridade_max_ord ?? 99) <= filtros.prioridadeMaxOrd!,
    );
  }

  if (filtros.somenteElegiveis) {
    result = result.filter((g) => g.quantidade_elegivel > 0);
  }

  if (filtros.somentesSemResponsavel) {
    result = result.filter((g) => g.ct_sem_responsavel > 0);
  }

  return result;
}
