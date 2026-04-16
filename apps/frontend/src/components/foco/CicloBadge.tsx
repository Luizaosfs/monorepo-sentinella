import { cn } from '@/lib/utils';
import {
  CICLO_LABELS,
  CICLO_STATUS_COR,
  CICLO_STATUS_LABEL,
  useCicloAtivo,
} from '@/hooks/queries/useCicloAtivo';

interface CicloBadgeProps {
  /** Se true, mostra "Ciclo N" sem status. Se false, mostra status também. */
  compact?: boolean;
  className?: string;
}

export function CicloBadge({ compact = false, className }: CicloBadgeProps) {
  const { data: ciclo, cicloNumero } = useCicloAtivo();

  const status = ciclo?.status ?? 'ativo';
  const label  = CICLO_LABELS[cicloNumero] ?? `Ciclo ${cicloNumero}`;

  if (compact) {
    return (
      <span className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border',
        CICLO_STATUS_COR[status],
        className,
      )}>
        {label}
      </span>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border',
        CICLO_STATUS_COR[status],
      )}>
        {label}
      </span>
      <span className="text-xs text-muted-foreground">
        {CICLO_STATUS_LABEL[status]}
        {ciclo?.meta_cobertura_pct && ` · Meta: ${ciclo.meta_cobertura_pct}%`}
      </span>
    </div>
  );
}
