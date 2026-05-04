import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Eraser, Filter } from 'lucide-react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type SortDirection = 'asc' | 'desc';

type ListColumnHeaderProps<TSortKey extends string> = {
  label: string;
  sortKey?: TSortKey;
  activeSort?: TSortKey;
  sortDir?: SortDirection;
  onSort?: (key: TSortKey) => void;
  filterContent?: ReactNode;
  isFiltered?: boolean;
  onClearFilter?: () => void;
  className?: string;
  contentClassName?: string;
  narrow?: boolean;
  popoverClassName?: string;
  filterHint?: string;
};

export function ListColumnHeader<TSortKey extends string>({
  label,
  sortKey,
  activeSort,
  sortDir = 'desc',
  onSort,
  filterContent,
  isFiltered = false,
  onClearFilter,
  className,
  contentClassName,
  narrow,
  popoverClassName,
  filterHint = 'Dica: use os filtros de outras colunas para combinar critérios.',
}: ListColumnHeaderProps<TSortKey>) {
  const sortable = !!sortKey && !!onSort;
  const active = sortable && activeSort === sortKey;

  return (
    <th
      className={cn(
        'py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground',
        narrow ? 'px-3' : 'px-4',
        className,
      )}
    >
      <div className={cn('flex items-center gap-1', contentClassName)}>
        {sortable ? (
          <button
            type="button"
            onClick={() => onSort(sortKey)}
            className="inline-flex max-w-[min(100%,11rem)] items-center gap-1 rounded-sm px-1.5 py-1 text-left transition-colors hover:bg-background hover:text-foreground"
            title="Ordenar por esta coluna"
          >
            <span className="truncate">{label}</span>
            {active ? (
              sortDir === 'asc' ? (
                <ArrowUp className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
              ) : (
                <ArrowDown className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
              )
            ) : (
              <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-40" aria-hidden />
            )}
          </button>
        ) : (
          <span className="truncate">{label}</span>
        )}

        {filterContent && (
          isFiltered ? (
            <button
              type="button"
              onClick={onClearFilter}
              className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-primary transition-colors hover:bg-primary/10"
              title={`Limpar filtro de ${label}`}
              aria-label={`Limpar filtro de ${label}`}
            >
              <Eraser className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                  title={`Filtrar ${label}`}
                  aria-label={`Filtrar ${label}`}
                >
                  <Filter className="h-3.5 w-3.5" aria-hidden />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className={cn('w-80 p-3 shadow-lg', popoverClassName)}>
                {filterContent}
                {filterHint ? (
                  <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{filterHint}</p>
                ) : null}
              </PopoverContent>
            </Popover>
          )
        )}
      </div>
    </th>
  );
}
