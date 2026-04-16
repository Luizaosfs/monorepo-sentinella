/**
 * Utilitários visuais para o SLA Inteligente (Fase C).
 * Re-exporta os helpers de slaInteligente.ts e adiciona lógica de apresentação.
 */
export {
  LABEL_STATUS_SLA_INT,
  LABEL_FASE_SLA,
  COR_STATUS_SLA_INT,
  formatarTempoMin,
  SEVERIDADE_SLA_INT,
  type SlaInteligenteStatus,
  type FaseSla,
} from '@/lib/slaInteligente';

import type { SlaInteligenteStatus } from '@/lib/slaInteligente';

/**
 * Prioridade numérica crescente: 1 = mais urgente.
 * Usar para ordenação client-side quando necessário.
 */
export const PRIORIDADE_SLA_INT: Record<SlaInteligenteStatus, number> = {
  vencido:   1,
  critico:   2,
  atencao:   3,
  ok:        4,
  sem_prazo: 5,
  encerrado: 6,
};

/**
 * Classes Tailwind para destaque de linha de tabela.
 * Aplicar somente para vencido e critico — não poluir em atencao/ok.
 */
export const DESTAQUE_LINHA_SLA: Partial<Record<SlaInteligenteStatus, string>> = {
  vencido: 'bg-red-50/50 dark:bg-red-950/10 hover:bg-red-50 dark:hover:bg-red-950/20',
  critico: 'bg-orange-50/30 dark:bg-orange-950/10 hover:bg-orange-50/50 dark:hover:bg-orange-950/20',
};

/**
 * Nome do ícone Lucide recomendado por status.
 * Usar apenas para destaques moderados — não exagerar.
 */
export const ICONE_SLA: Partial<Record<SlaInteligenteStatus, string>> = {
  vencido: 'AlertTriangle',
  critico: 'AlertCircle',
  atencao: 'Clock',
};

/** Retorna o label URL amigável para filtro query param. */
export function slaInteligenteParamLabel(status: SlaInteligenteStatus): string {
  return status;
}
