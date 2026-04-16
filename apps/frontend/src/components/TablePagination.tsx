import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

interface TablePaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize?: number;
  onGoTo: (page: number) => void;
  onNext: () => void;
  onPrev: () => void;
  onPageSizeChange?: (size: number) => void;
}

const TablePagination = ({ page, totalPages, total, pageSize = 10, onGoTo, onNext, onPrev, onPageSizeChange }: TablePaginationProps) => {
  if (totalPages <= 1 && !onPageSizeChange) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border flex-wrap gap-2">
      <div className="flex items-center gap-3">
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Por página:</span>
            <Select value={pageSize.toString()} onValueChange={(v) => onPageSizeChange(Number(v))}>
              <SelectTrigger className="h-7 w-[68px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s.toString()} className="text-xs">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {start}–{end} de {total}
        </p>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onGoTo(1)} disabled={page <= 1}>
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onPrev} disabled={page <= 1}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs font-medium px-2 text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNext} disabled={page >= totalPages}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onGoTo(totalPages)} disabled={page >= totalPages}>
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default TablePagination;
