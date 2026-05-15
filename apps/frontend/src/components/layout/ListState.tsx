import type { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface ListStateProps {
  isLoading: boolean;
  isEmpty: boolean;
  /** Ícone do estado vazio (ex.: <Stethoscope className="h-8 w-8 mx-auto mb-2 opacity-30" />). */
  emptyIcon: ReactNode;
  emptyText: string;
  /** Conteúdo quando há dados. */
  children: ReactNode;
  skeletonCount?: number;
  skeletonClassName?: string;
}

/**
 * Estados de lista padronizados (loading / vazio / conteúdo).
 *
 * Reproduz exatamente o padrão já usado em "Meus registros recentes"
 * (skeleton `h-12 rounded-xl`; vazio centralizado `text-xs`) — sem mudança visual.
 */
export function ListState({
  isLoading,
  isEmpty,
  emptyIcon,
  emptyText,
  children,
  skeletonCount = 3,
  skeletonClassName = 'h-12 rounded-xl',
}: ListStateProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: skeletonCount }, (_, i) => (
          <Skeleton key={i} className={skeletonClassName} />
        ))}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="text-center py-6 text-muted-foreground text-xs">
        {emptyIcon}
        {emptyText}
      </div>
    );
  }

  return <>{children}</>;
}
