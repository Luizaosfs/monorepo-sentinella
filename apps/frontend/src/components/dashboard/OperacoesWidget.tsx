import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { Clock, PlayCircle, CheckCircle2, AlertTriangle, ArrowUpRight, ClipboardCheck, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useOperacoesByCliente } from '@/hooks/queries/useOperacoes';

interface Props {
  clienteId: string | null;
}

interface StatusCount {
  pendente: number;
  em_andamento: number;
  concluido: number;
  cancelado: number;
}

interface PrioridadeCount {
  Urgente: number;
  Alta: number;
  Média: number;
  Baixa: number;
}

const statusConfig = [
  { key: 'pendente', label: 'Pendentes', icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/10', tooltip: 'Operações criadas mas ainda não iniciadas. Aguardam atribuição ou início.' },
  { key: 'em_andamento', label: 'Em Andamento', icon: PlayCircle, color: 'text-info', bg: 'bg-info/10', tooltip: 'Operações em execução ativa por drone ou equipe de campo.' },
  { key: 'concluido', label: 'Concluídas', icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10', tooltip: 'Operações finalizadas com sucesso com todos os levantamentos registrados.' },
  { key: 'cancelado', label: 'Canceladas', icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10', tooltip: 'Operações canceladas antes da conclusão (clima, logística, decisão administrativa).' },
] as const;

const prioridadeConfig = [
  { key: 'Urgente', color: 'bg-red-500' },
  { key: 'Alta', color: 'bg-orange-500' },
  { key: 'Média', color: 'bg-yellow-500' },
  { key: 'Baixa', color: 'bg-emerald-500' },
] as const;

export const OperacoesWidget = ({ clienteId }: Props) => {
  const navigate = useNavigate();
  const { data: rows = [], isLoading: loading } = useOperacoesByCliente(clienteId);

  const { total, statusCounts, prioridadeCounts } = useMemo(() => {
    const sc: StatusCount = { pendente: 0, em_andamento: 0, concluido: 0, cancelado: 0 };
    const pc: PrioridadeCount = { Urgente: 0, Alta: 0, Média: 0, Baixa: 0 };
    for (const r of rows) {
      if (r.status in sc) sc[r.status as keyof StatusCount]++;
      if (r.prioridade && r.prioridade in pc) pc[r.prioridade as keyof PrioridadeCount]++;
    }
    return { total: rows.length, statusCounts: sc, prioridadeCounts: pc };
  }, [rows]);

  if (loading) {
    return (
      <Card className="rounded-2xl shadow-sm border-border/60 bg-card">
        <CardHeader className="p-5 pb-3"><Skeleton className="h-5 w-40" /></CardHeader>
        <CardContent className="p-5 pt-0 space-y-3">
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (total === 0) return null;

  const completionRate = total > 0 ? Math.round((statusCounts.concluido / total) * 100) : 0;

  return (
    <Card className="rounded-2xl shadow-sm border-border/60 bg-card overflow-hidden animate-fade-in">
      <CardHeader className="flex flex-row items-center justify-between p-5 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <ClipboardCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-foreground">Operações</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{total} total — {completionRate}% concluídas</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/gestor/operacoes')}
          className="h-8 px-3 rounded-lg border border-border/60 text-[11px] font-bold text-foreground hover:bg-muted/40 transition-colors shadow-sm flex items-center gap-1"
        >
          Ver todas <ArrowUpRight className="h-3 w-3" />
        </button>
      </CardHeader>

      <CardContent className="p-5 space-y-5">
        <TooltipProvider delayDuration={300}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {statusConfig.map((s) => {
              const count = statusCounts[s.key];
              return (
                <Tooltip key={s.key}>
                  <TooltipTrigger asChild>
                    <div className={cn('rounded-xl p-3 flex items-center gap-2.5 relative cursor-default', s.bg)}>
                      <Info className="absolute top-1.5 right-1.5 w-2.5 h-2.5 text-muted-foreground/40" />
                      <s.icon className={cn('h-4 w-4 shrink-0', s.color)} />
                      <div>
                        <p className="text-lg font-black leading-none">{count}</p>
                        <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{s.label}</p>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[200px] text-xs leading-relaxed">{s.tooltip}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Distribuição por prioridade</p>
          <div className="flex h-3 rounded-full overflow-hidden bg-muted/40">
            {prioridadeConfig.map((p) => {
              const count = prioridadeCounts[p.key];
              if (count === 0) return null;
              const pct = (count / total) * 100;
              return (
                <div
                  key={p.key}
                  className={cn('h-full transition-all', p.color)}
                  style={{ width: `${pct}%` }}
                  title={`${p.key}: ${count}`}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3">
            {prioridadeConfig.map((p) => {
              const count = prioridadeCounts[p.key];
              if (count === 0) return null;
              return (
                <div key={p.key} className="flex items-center gap-1.5">
                  <span className={cn('w-2 h-2 rounded-full', p.color)} />
                  <span className="text-[11px] font-medium text-muted-foreground">{p.key} ({count})</span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
