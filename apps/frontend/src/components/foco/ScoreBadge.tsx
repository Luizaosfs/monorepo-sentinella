import { cn } from '@/lib/utils';
import { COR_SCORE, LABEL_SCORE } from '@/hooks/queries/useScoreTerritorial';

interface ScoreBadgeProps {
  score: number;
  classificacao: string;
  showScore?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ScoreBadge({
  score,
  classificacao,
  showScore = true,
  size = 'md',
  className,
}: ScoreBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border font-semibold',
        size === 'sm' && 'px-1.5 py-0.5 text-[10px]',
        size === 'md' && 'px-2 py-1 text-xs',
        size === 'lg' && 'px-3 py-1.5 text-sm',
        COR_SCORE[classificacao] ?? COR_SCORE['baixo'],
        className,
      )}
    >
      {showScore && (
        <span className="tabular-nums">{Math.round(score)}</span>
      )}
      {LABEL_SCORE[classificacao] ?? classificacao}
    </span>
  );
}
