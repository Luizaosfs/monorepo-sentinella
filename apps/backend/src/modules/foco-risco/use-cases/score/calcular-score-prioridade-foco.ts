export interface ScoreInputs {
  status: string;
  focoAnteriorId: string | null;
  latitude: number | null;
  longitude: number | null;
  prazoMinutos: number | null;
  tempoNoEstadoMinutos: number | null;
  casosProximosCount: number;
}

const TERMINAIS = new Set(['resolvido', 'descartado']);

function scoreSla(prazoMinutos: number | null, tempoNoEstadoMinutos: number | null): number {
  if (!prazoMinutos || tempoNoEstadoMinutos == null) return 10;
  if (tempoNoEstadoMinutos > prazoMinutos) return 50;
  if (tempoNoEstadoMinutos >= prazoMinutos * 0.9) return 40;
  if (tempoNoEstadoMinutos >= prazoMinutos * 0.7) return 20;
  return 10;
}

/**
 * Porta TypeScript de `calcular_score_prioridade_foco` (dump linha 363).
 * Trigger legado: score=0 para terminais (resolvido/descartado), calculado para demais.
 */
export function calcularScorePrioridadeFoco(inputs: ScoreInputs): number {
  if (TERMINAIS.has(inputs.status)) return 0;

  let score = scoreSla(inputs.prazoMinutos, inputs.tempoNoEstadoMinutos);

  if (inputs.focoAnteriorId != null) score += 20;

  if (inputs.latitude != null && inputs.longitude != null) {
    score += Math.min(inputs.casosProximosCount * 5, 30);
  }

  return score;
}
