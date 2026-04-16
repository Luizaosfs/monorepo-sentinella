/**
 * PrioridadeBadge — Badge visual para prioridade_final (P1–P5).
 *
 * P1 = vermelho escuro  (crítico — ação imediata)
 * P2 = laranja          (alto)
 * P3 = amarelo          (médio)
 * P4 = verde            (baixo)
 * P5 = cinza            (monitoramento)
 */
import { cn } from '@/lib/utils';

type Prioridade = 'P1' | 'P2' | 'P3' | 'P4' | 'P5';

interface PrioridadeBadgeProps {
  prioridade: Prioridade | null | undefined;
  /** 'sm' (default) | 'md' | 'lg' */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const PRIORIDADE_CFG: Record<Prioridade, { label: string; bg: string }> = {
  P1: { label: 'P1',  bg: 'bg-red-600 text-white' },
  P2: { label: 'P2',  bg: 'bg-orange-500 text-white' },
  P3: { label: 'P3',  bg: 'bg-yellow-400 text-yellow-900' },
  P4: { label: 'P4',  bg: 'bg-green-500 text-white' },
  P5: { label: 'P5',  bg: 'bg-gray-300 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
};

const SIZE_CFG = {
  sm: 'text-[10px] font-bold px-1.5 py-0.5 rounded',
  md: 'text-xs font-bold px-2 py-1 rounded-md',
  lg: 'text-sm font-bold px-2.5 py-1 rounded-md',
};

export function PrioridadeBadge({ prioridade, size = 'sm', className }: PrioridadeBadgeProps) {
  if (!prioridade) return null;
  const cfg = PRIORIDADE_CFG[prioridade];
  return (
    <span className={cn('inline-flex items-center shrink-0', cfg.bg, SIZE_CFG[size], className)}>
      {cfg.label}
    </span>
  );
}
