import { History, CheckCircle2, CircleDot, Circle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useItemStatusHistorico } from '@/hooks/queries/useItemStatusHistorico';
import type { StatusAtendimento } from '@/types/database';

const STATUS_CONFIG: Record<StatusAtendimento, { label: string; color: string }> = {
  pendente:       { label: 'Pendente',       color: 'text-muted-foreground' },
  em_atendimento: { label: 'Em atendimento', color: 'text-blue-600' },
  resolvido:      { label: 'Resolvido',      color: 'text-emerald-600' },
};

interface ItemSlaTimelineProps {
  itemId: string;
}

export function ItemSlaTimeline({ itemId }: ItemSlaTimelineProps) {
  const { data: historico = [] } = useItemStatusHistorico(itemId);

  if (historico.length === 0) return null;

  return (
    <Card className="rounded-2xl border-2 border-border bg-card shadow-none overflow-hidden">
      <CardContent className="px-3 py-2.5 sm:px-4 sm:py-3 space-y-2.5">
        <h4 className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
          <History className="w-4 h-4" /> Histórico de atendimento
        </h4>
        <div className="relative pl-4">
          {/* Linha vertical */}
          <div className="absolute left-[7px] top-1 bottom-1 w-px bg-border" />
          <div className="space-y-3">
            {historico.map((h, idx) => {
              const cfg = STATUS_CONFIG[h.status_novo] ?? STATUS_CONFIG['pendente'];
              return (
                <div key={h.id} className="relative flex gap-2.5 items-start">
                  {/* Dot */}
                  <div className={cn(
                    'absolute -left-4 mt-0.5 h-3.5 w-3.5 rounded-full border-2 border-background flex items-center justify-center',
                    h.status_novo === 'resolvido' ? 'bg-emerald-500' :
                    h.status_novo === 'em_atendimento' ? 'bg-blue-500' : 'bg-muted-foreground'
                  )} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={cn('text-[11px] font-semibold', cfg.color)}>
                        {cfg.label}
                      </span>
                      {h.usuario?.nome && (
                        <span className="text-[10px] text-muted-foreground">por {h.usuario.nome}</span>
                      )}
                      {idx === 0 && (
                        <span className="text-[9px] bg-primary/10 text-primary rounded-full px-1.5 py-0.5 font-semibold uppercase tracking-wide">
                          Atual
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                      {new Date(h.alterado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {h.acao_aplicada_nova && (
                      <p className="text-[10px] text-foreground/70 mt-0.5 italic">"{h.acao_aplicada_nova}"</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
