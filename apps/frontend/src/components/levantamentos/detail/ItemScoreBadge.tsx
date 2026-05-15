import { TrendingUp, Loader2, ThumbsDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getScoreConfig } from '@/lib/scoreNormalization';

interface ItemScoreBadgeProps {
  scoreNorm: number | null;
  /** Whether the item has a false-positive flag */
  isFalsoPositivo: boolean;
  isSavingFeedback: boolean;
  onFalsoPositivo: () => void;
  className?: string;
}

export function ItemScoreBadge({
  scoreNorm,
  isFalsoPositivo,
  isSavingFeedback,
  onFalsoPositivo,
  className,
}: ItemScoreBadgeProps) {
  return (
    <Card className={cn('rounded-2xl border-2 border-border bg-card/50 shadow-sm overflow-hidden', className)}>
      <CardContent className="px-3 py-2.5 sm:px-4 sm:py-3 space-y-2">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <span className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5 min-w-0">
            <TrendingUp className="w-3.5 h-3.5 shrink-0" /> Confiança YOLO
          </span>
          {scoreNorm != null ? (
            <span className={cn('text-sm font-bold shrink-0', getScoreConfig(scoreNorm).textColor)}>
              {Math.round(scoreNorm * 100)}%
            </span>
          ) : (
            <span className="text-[10px] bg-muted rounded-full px-2 py-0.5 text-muted-foreground font-medium">
              Entrada manual
            </span>
          )}
        </div>
        {scoreNorm != null ? (
          <>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-700', getScoreConfig(scoreNorm).barColor)}
                style={{ width: `${Math.round(scoreNorm * 100)}%` }}
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-2 min-w-0">
              <p className={cn('text-[10px] font-semibold uppercase tracking-wider shrink-0', getScoreConfig(scoreNorm).textColor)}>
                {getScoreConfig(scoreNorm).label}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  'h-auto min-h-6 px-2 py-1 text-[10px] gap-1 rounded-lg shrink-0 sm:max-w-none max-w-full',
                  isFalsoPositivo
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 hover:bg-rose-200'
                    : 'text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20'
                )}
                onClick={onFalsoPositivo}
                disabled={isSavingFeedback}
                title="Marcar como não confirmado em campo (falso positivo)"
              >
                {isSavingFeedback ? <Loader2 className="w-3 h-3 animate-spin" /> : <ThumbsDown className="w-3 h-3" />}
                {isFalsoPositivo ? 'Falso positivo' : 'Não confirmado'}
              </Button>
            </div>
          </>
        ) : (
          <p className="text-[10px] text-muted-foreground">Sem análise automática disponível</p>
        )}
      </CardContent>
    </Card>
  );
}
