export type SlaInteligenteStatus =
  | 'ok'
  | 'atencao'
  | 'critico'
  | 'vencido'
  | 'sem_prazo'
  | 'encerrado';

export type FaseSla =
  | 'triagem'
  | 'inspecao'
  | 'confirmacao'
  | 'tratamento'
  | 'encerrado';

export const LABEL_STATUS_SLA_INT: Record<SlaInteligenteStatus, string> = {
  ok:        'No prazo',
  atencao:   'Atenção',
  critico:   'Crítico',
  vencido:   'Vencido',
  sem_prazo: 'Sem prazo',
  encerrado: 'Encerrado',
};

export const LABEL_FASE_SLA: Record<FaseSla, string> = {
  triagem:     'Triagem',
  inspecao:    'Inspeção',
  confirmacao: 'Confirmação',
  tratamento:  'Tratamento',
  encerrado:   'Encerrado',
};

/** Tailwind classes para badge de status SLA inteligente. */
export const COR_STATUS_SLA_INT: Record<SlaInteligenteStatus, string> = {
  ok:        'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  atencao:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  critico:   'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  vencido:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  sem_prazo: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  encerrado: 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500',
};

/**
 * Formata minutos em string legível.
 * < 60 min  → "Xm"
 * < 1440 min → "Xh Ym"
 * >= 1440 min → "Xd Xh"
 */
export function formatarTempoMin(min: number | null | undefined): string {
  if (min == null) return '—';
  const m = Math.round(min);
  if (m < 60) return `${m}m`;
  if (m < 1440) {
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
  }
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  return h > 0 ? `${d}d ${h}h` : `${d}d`;
}

/** Ordenação de severidade para listagem (maior = mais urgente). */
export const SEVERIDADE_SLA_INT: Record<SlaInteligenteStatus, number> = {
  vencido:   5,
  critico:   4,
  atencao:   3,
  ok:        2,
  sem_prazo: 1,
  encerrado: 0,
};
