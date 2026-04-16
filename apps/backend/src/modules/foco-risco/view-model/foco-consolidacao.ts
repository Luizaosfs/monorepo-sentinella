/**
 * Consolidação analítica do foco: no banco Supabase as colunas canônicas
 * (prioridade_final, dimensao_dominante, consolidacao_json, dimensões de risco, etc.)
 * vivem em `vistorias`, não em `focos_risco`. O foco mantém `prioridade` + `score_prioridade`
 * (operacional) e `payload` (JSON legado / extensões).
 *
 * Este módulo apenas **estrutura e expõe** dados já persistidos — sem novo algoritmo de cálculo.
 */

export type FocoConsolidacaoDimensoesHttp = {
  riscoVetorial: string | null;
  riscoSocioambiental: string | null;
  vulnerabilidadeDomiciliar: string | null;
  alertaSaude: string | null;
};

export type FocoConsolidacaoOrigemHttp = {
  /** Origem declarada no foco (levantamento, vistoria, etc.) */
  origemFocoTipo: string;
  /** De onde vieram os campos de consolidação expostos abaixo */
  fonte: 'vistoria' | 'payload_foco' | 'indisponivel';
  /** Vistoria cuja linha forneceu o snapshot (quando fonte === vistoria) */
  vistoriaId?: string;
};

export type FocoConsolidacaoHttp = {
  dimensoes: FocoConsolidacaoDimensoesHttp;
  resultadoOperacional: string | null;
  prioridadeFinal: string | null;
  prioridadeMotivo: string | null;
  dimensaoDominante: string | null;
  consolidacaoResumo: string | null;
  consolidacaoJson: Record<string, unknown> | null;
  consolidacaoIncompleta: boolean;
  consolidadoEm: Date | null;
  versaoRegraConsolidacao: string | null;
  versaoPesosConsolidacao: string | null;
  origem: FocoConsolidacaoOrigemHttp;
};

type VistoriaConsolidacaoRow = {
  id: string;
  resultado_operacional: string | null;
  vulnerabilidade_domiciliar: string | null;
  alerta_saude: string | null;
  risco_socioambiental: string | null;
  risco_vetorial: string | null;
  prioridade_final: string | null;
  prioridade_motivo: string | null;
  dimensao_dominante: string | null;
  consolidacao_resumo: string | null;
  consolidacao_json: unknown;
  consolidacao_incompleta: boolean;
  consolidado_em: Date | null;
  versao_regra_consolidacao: string | null;
  versao_pesos_consolidacao: string | null;
};

function consolidacaoJsonAsRecord(v: unknown): Record<string, unknown> | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object' && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return null;
}

/** Pontua linha da vistoria: prefere linhas com consolidação efetiva ou mais recentes. */
export function scoreVistoriaConsolidacao(row: VistoriaConsolidacaoRow): number {
  let s = 0;
  if (row.consolidado_em) s += 1_000_000;
  if (row.prioridade_final) s += 100_000;
  if (row.consolidacao_json != null) s += 50_000;
  if (row.dimensao_dominante) s += 10_000;
  if (row.resultado_operacional) s += 1_000;
  if (
    row.risco_vetorial ||
    row.risco_socioambiental ||
    row.vulnerabilidade_domiciliar ||
    row.alerta_saude
  ) {
    s += 100;
  }
  if (row.consolidado_em) {
    s += Math.min(row.consolidado_em.getTime() / 1e10, 99);
  }
  return s;
}

export function vistoriaRowToConsolidacaoHttp(
  row: VistoriaConsolidacaoRow,
  origemFocoTipo: string,
): FocoConsolidacaoHttp {
  return {
    dimensoes: {
      riscoVetorial: row.risco_vetorial,
      riscoSocioambiental: row.risco_socioambiental,
      vulnerabilidadeDomiciliar: row.vulnerabilidade_domiciliar,
      alertaSaude: row.alerta_saude,
    },
    resultadoOperacional: row.resultado_operacional,
    prioridadeFinal: row.prioridade_final,
    prioridadeMotivo: row.prioridade_motivo,
    dimensaoDominante: row.dimensao_dominante,
    consolidacaoResumo: row.consolidacao_resumo,
    consolidacaoJson: consolidacaoJsonAsRecord(row.consolidacao_json),
    consolidacaoIncompleta: row.consolidacao_incompleta,
    consolidadoEm: row.consolidado_em,
    versaoRegraConsolidacao: row.versao_regra_consolidacao,
    versaoPesosConsolidacao: row.versao_pesos_consolidacao,
    origem: {
      origemFocoTipo,
      fonte: 'vistoria',
      vistoriaId: row.id,
    },
  };
}

type PayloadConsolidacaoLegado = {
  prioridadeFinal?: string;
  prioridade_final?: string;
  dimensaoDominante?: string;
  dimensao_dominante?: string;
  consolidacaoJson?: Record<string, unknown>;
  consolidacao_json?: Record<string, unknown>;
  dimensoes?: Partial<FocoConsolidacaoDimensoesHttp>;
};

/** Fallback quando não há vistoria com colunas — apenas chaves já usadas em payload livre. */
export function consolidacaoFromFocoPayload(
  payload: unknown,
  origemFocoTipo: string,
): FocoConsolidacaoHttp | null {
  if (payload === null || payload === undefined) return null;
  if (typeof payload !== 'object' || Array.isArray(payload)) return null;

  const p = payload as PayloadConsolidacaoLegado & Record<string, unknown>;
  const prioridadeFinal =
    p.prioridadeFinal ?? p.prioridade_final ?? null;
  const dimensaoDominante =
    p.dimensaoDominante ?? p.dimensao_dominante ?? null;
  const consolidacaoJson =
    (p.consolidacaoJson ?? p.consolidacao_json) ?? null;
  const dim = (p.dimensoes ?? {}) as Partial<FocoConsolidacaoDimensoesHttp>;

  const hasAny =
    prioridadeFinal ||
    dimensaoDominante ||
    consolidacaoJson ||
    dim.riscoVetorial ||
    dim.riscoSocioambiental ||
    dim.vulnerabilidadeDomiciliar ||
    dim.alertaSaude;

  if (!hasAny) return null;

  return {
    dimensoes: {
      riscoVetorial: dim.riscoVetorial ?? null,
      riscoSocioambiental: dim.riscoSocioambiental ?? null,
      vulnerabilidadeDomiciliar: dim.vulnerabilidadeDomiciliar ?? null,
      alertaSaude: dim.alertaSaude ?? null,
    },
    resultadoOperacional: null,
    prioridadeFinal,
    prioridadeMotivo: null,
    dimensaoDominante,
    consolidacaoResumo: null,
    consolidacaoJson: consolidacaoJsonAsRecord(consolidacaoJson),
    consolidacaoIncompleta: false,
    consolidadoEm: null,
    versaoRegraConsolidacao: null,
    versaoPesosConsolidacao: null,
    origem: {
      origemFocoTipo,
      fonte: 'payload_foco',
    },
  };
}

export function pickMelhorVistoriaConsolidacao(
  rows: VistoriaConsolidacaoRow[],
): VistoriaConsolidacaoRow | null {
  if (rows.length === 0) return null;
  return [...rows].sort(
    (a, b) => scoreVistoriaConsolidacao(b) - scoreVistoriaConsolidacao(a),
  )[0];
}

/** Snapshot vazio com forma fixa — útil para o cliente não depender de JSON solto no foco. */
export function consolidacaoIndisponivel(
  origemFocoTipo: string,
): FocoConsolidacaoHttp {
  return {
    dimensoes: {
      riscoVetorial: null,
      riscoSocioambiental: null,
      vulnerabilidadeDomiciliar: null,
      alertaSaude: null,
    },
    resultadoOperacional: null,
    prioridadeFinal: null,
    prioridadeMotivo: null,
    dimensaoDominante: null,
    consolidacaoResumo: null,
    consolidacaoJson: null,
    consolidacaoIncompleta: false,
    consolidadoEm: null,
    versaoRegraConsolidacao: null,
    versaoPesosConsolidacao: null,
    origem: {
      origemFocoTipo,
      fonte: 'indisponivel',
    },
  };
}
