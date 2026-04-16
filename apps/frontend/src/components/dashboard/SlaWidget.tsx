import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import {
  Clock, AlertTriangle, CheckCircle2, Timer, ArrowUpRight, TrendingUp, Info,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { getSlaVisualStatus, getSlaLocalLabel, getTempoRestante, SlaOperacional } from '@/types/sla';
import { useSlaByCliente } from '@/hooks/queries/useSla';

const statusColors: Record<string, string> = {
  pendente: 'bg-muted text-muted-foreground',
  em_atendimento: 'bg-info/15 text-info',
  concluido: 'bg-success/15 text-success',
  vencido: 'bg-destructive/15 text-destructive',
};

const visualEmoji: Record<string, string> = { ok: '🟢', warning: '🟡', expired: '🔴' };

interface Props {
  clienteId: string | null;
}

export function SlaWidget({ clienteId }: Props) {
  const navigate = useNavigate();
  const { data: slas = [], isLoading: loading } = useSlaByCliente(clienteId);

  const metrics = useMemo(() => {
    const total = slas.length;
    const concluidos = slas.filter((s) => s.status === 'concluido' && !s.violado).length;
    const violados = slas.filter((s) => s.violado).length;
    const pendentes = slas.filter((s) => s.status === 'pendente' || s.status === 'em_atendimento').length;
    const pctCumprido = total > 0 ? Math.round((concluidos / total) * 100) : 0;
    const pctViolado = total > 0 ? Math.round((violados / total) * 100) : 0;

    const criticos = slas.filter(
      (s) =>
        !s.concluido_em &&
        (s.prioridade === 'Crítica' || s.prioridade === 'Urgente') &&
        (s.status === 'pendente' || s.status === 'em_atendimento' || s.status === 'vencido')
    );

    return { total, pctCumprido, pctViolado, pendentes, violados, criticos };
  }, [slas]);

  if (loading) {
    return (
      <Card className="card-premium animate-fade-in">
        <CardHeader className="p-6 pb-4"><Skeleton className="h-5 w-40" /></CardHeader>
        <CardContent className="p-6 pt-0 space-y-3">
          <div className="grid grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
          <Skeleton className="h-32" />
        </CardContent>
      </Card>
    );
  }

  if (slas.length === 0) return null;

  const urgentSlas = slas.filter((s) => s.status !== 'concluido').slice(0, 5);

  return (
    <Card className="card-premium animate-fade-in overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between p-6 pb-4 border-b border-border/40 bg-muted/20">
        <div>
          <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1.5 flex items-center gap-1.5">
            <Timer className="w-3 h-3" />
            Controle de Prazos
          </p>
          <CardTitle className="text-base lg:text-xl font-bold">SLA Operacional</CardTitle>
        </div>
        <button
          onClick={() => navigate('/agente/hoje')}
          className="h-9 px-4 rounded-xl bg-primary/10 text-[11px] font-bold tracking-wide text-primary hover:bg-primary hover:text-white transition-all duration-300 flex items-center gap-1.5"
        >
          Ver painel <ArrowUpRight className="w-3 h-3" />
        </button>
      </CardHeader>

      <CardContent className="p-6 space-y-5">
        <TooltipProvider delayDuration={300}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <MiniMetric icon={CheckCircle2} label="Cumprido" value={`${metrics.pctCumprido}%`} color="text-success" tooltip="Percentual de SLAs concluídos dentro do prazo estabelecido." />
            <MiniMetric icon={AlertTriangle} label="Violado" value={`${metrics.pctViolado}%`} color="text-destructive" tooltip="Percentual de SLAs com prazo expirado sem conclusão. Meta ideal: 0%." />
            <MiniMetric icon={Clock} label="Pendentes" value={metrics.pendentes} color="text-warning" tooltip="SLAs em andamento (pendente ou em atendimento) que ainda não foram concluídos." />
            <MiniMetric icon={TrendingUp} label="Total" value={metrics.total} color="text-primary" tooltip="Total de SLAs cadastrados para este cliente em todos os status." />
          </div>
        </TooltipProvider>

        {metrics.criticos.length > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
            <p className="text-xs font-semibold text-destructive">
              {metrics.criticos.length} item(ns) crítico(s) pendente(s) de atendimento
            </p>
          </div>
        )}

        {urgentSlas.length > 0 && (
          <div className="divide-y divide-border/40">
            {urgentSlas.map((sla) => {
              const visual = getSlaVisualStatus(sla);
              return (
                <div
                  key={sla.id}
                  className={cn(
                    'flex items-center justify-between py-3 px-1 cursor-pointer hover:bg-muted/30 transition-colors rounded-lg',
                    visual === 'expired' && 'bg-destructive/5'
                  )}
                  onClick={() => navigate('/agente/hoje')}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-base">{visualEmoji[visual]}</span>
                    <div>
                      <p className="text-sm font-semibold">{getSlaLocalLabel(sla)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {sla.prioridade} · SLA {sla.sla_horas}h
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'text-xs font-bold',
                        visual === 'expired' ? 'text-destructive' : visual === 'warning' ? 'text-warning' : 'text-success'
                      )}
                    >
                      {getTempoRestante(sla.prazo_final)}
                    </span>
                    <Badge className={cn('text-[9px] font-bold border-0', statusColors[sla.status])}>
                      {sla.status === 'em_atendimento' ? 'Atendendo' : sla.status === 'vencido' ? 'Vencido' : 'Pendente'}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MiniMetric({
  icon: Icon,
  label,
  value,
  color,
  tooltip,
}: {
  icon: typeof Clock;
  label: string;
  value: string | number;
  color: string;
  tooltip?: string;
}) {
  const inner = (
    <div className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/30 border border-border/30 relative">
      {tooltip && <Info className="absolute top-1.5 right-1.5 w-3 h-3 text-muted-foreground/40" />}
      <Icon className={cn('w-4 h-4 shrink-0', color)} />
      <div>
        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-lg font-black tabular-nums leading-tight">{value}</p>
      </div>
    </div>
  );
  if (!tooltip) return inner;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{inner}</TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[200px] text-xs leading-relaxed">{tooltip}</TooltipContent>
    </Tooltip>
  );
}
