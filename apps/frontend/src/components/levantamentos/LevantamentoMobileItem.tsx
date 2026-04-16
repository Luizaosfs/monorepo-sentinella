import { LevantamentoItem } from '@/types/database';
import { resolveMediaUrl } from '@/lib/media';
import { StatusBadge } from './StatusBadge';
import { CheckCircle2, CircleDot, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STATUS_LEVANTAMENTO_LABEL as STATUS_LABEL } from '@/lib/labels';

interface LevantamentoMobileItemProps {
  item: LevantamentoItem;
  onClick: (item: LevantamentoItem) => void;
}

const STATUS_ICON = {
  pendente:       <Circle className="w-3.5 h-3.5 text-muted-foreground" />,
  em_atendimento: <CircleDot className="w-3.5 h-3.5 text-blue-500" />,
  resolvido:      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
};

export const LevantamentoMobileItem = ({ item, onClick }: LevantamentoMobileItemProps) => {
  const status = item.status_atendimento ?? 'pendente';
  return (
    <div
      className={cn(
        'rounded-2xl border-2 p-3 bg-card shadow-sm cursor-pointer active:scale-[0.99] transition-all hover:shadow-md',
        status === 'resolvido'   ? 'border-emerald-200 dark:border-emerald-900 opacity-70' :
        status === 'em_atendimento' ? 'border-blue-200 dark:border-blue-900' :
        'border-border hover:border-primary/40'
      )}
      onClick={() => onClick(item)}
    >
      <div className="flex gap-2.5">
        {resolveMediaUrl(item.image_url) && (
          <div className="shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 border-border bg-muted">
            <img src={resolveMediaUrl(item.image_url)!} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-sm line-clamp-2 flex-1">{item.item || '—'}</p>
            <StatusBadge type="risco" value={item.risco} />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <StatusBadge type="prioridade" value={item.prioridade} />
            <span className="font-mono font-semibold text-muted-foreground">Score {item.score_final ?? '—'}</span>
            {item.sla_horas && <span className="font-mono text-muted-foreground">{item.sla_horas}h</span>}
            <span className={cn('flex items-center gap-1', status === 'resolvido' ? 'text-emerald-600' : status === 'em_atendimento' ? 'text-blue-600' : 'text-muted-foreground')}>
              {STATUS_ICON[status as keyof typeof STATUS_ICON]}
              {STATUS_LABEL[status as keyof typeof STATUS_LABEL]}
            </span>
          </div>
          {item.endereco_curto && (
            <p className="text-xs text-muted-foreground line-clamp-1">{item.endereco_curto}</p>
          )}
          {item.codigo_foco && (
            <p className="text-[10px] font-mono text-muted-foreground/70">{item.codigo_foco}</p>
          )}
        </div>
      </div>
    </div>
  );
};
