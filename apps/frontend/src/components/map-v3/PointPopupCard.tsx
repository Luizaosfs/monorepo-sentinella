import { LevantamentoItem } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronRight, Calendar, BrainCircuit } from 'lucide-react';

interface PointPopupCardProps {
  item: LevantamentoItem;
  onVerDetalhes: () => void;
  onClose?: () => void;
}

function getRiskClass(risk: string | null): string {
  switch ((risk || '').toLowerCase()) {
    case 'critico':
    case 'alto':
      return 'bg-red-500/15 text-red-400 border-red-500/30';
    case 'medio':
      return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
    case 'baixo':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    default:
      return 'bg-muted/60 text-muted-foreground border-border';
  }
}

export function PointPopupCard({
  item,
  onVerDetalhes,
}: PointPopupCardProps) {
  const score = item.score_final ?? item.peso;
  const timestamp = item.data_hora ?? item.created_at;
  const dateShort = timestamp
    ? new Date(timestamp).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  return (
    <div className="min-w-[200px] max-w-[260px] rounded-xl bg-background/95 border border-border shadow-md backdrop-blur p-3 font-sans">
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-foreground capitalize truncate">
            {item.item || 'Item'}
          </span>
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 h-5 font-semibold capitalize ${getRiskClass(item.risco)}`}
          >
            {item.risco || '—'}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {score != null && (
            <span className="flex items-center gap-1 font-medium">
              <BrainCircuit className="w-3 h-3" />
              Score {score}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {dateShort}
          </span>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="w-full h-8 text-xs font-semibold rounded-lg bg-secondary hover:bg-secondary/80 border-border shadow-sm text-secondary-foreground"
          onClick={onVerDetalhes}
        >
          Ver detalhes
          <ChevronRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}
