import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { Timer, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSlaByCliente } from '@/hooks/queries/useSla';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  clienteId: string | null;
}

interface DayPoint {
  date: string;
  label: string;
  total: number;
  concluidos: number;
  violados: number;
  pctCumprido: number;
  pctViolado: number;
}

export function SlaEvolutionChart({ clienteId }: Props) {
  const navigate = useNavigate();
  const { data: slas = [], isLoading: loading } = useSlaByCliente(clienteId);

  const chartData = useMemo<DayPoint[]>(() => {
    if (slas.length === 0) return [];

    // Group SLAs by their start date
    const dayMap = new Map<string, { total: number; concluidos: number; violados: number }>();

    slas.forEach(s => {
      const day = s.inicio.slice(0, 10); // YYYY-MM-DD
      if (!dayMap.has(day)) dayMap.set(day, { total: 0, concluidos: 0, violados: 0 });
      const entry = dayMap.get(day)!;
      entry.total++;
      if (s.status === 'concluido' && !s.violado) entry.concluidos++;
      if (s.violado) entry.violados++;
    });

    // Build cumulative series
    const sortedDays = Array.from(dayMap.keys()).sort();
    let cumTotal = 0;
    let cumConcluidos = 0;
    let cumViolados = 0;

    return sortedDays.map(day => {
      const d = dayMap.get(day)!;
      cumTotal += d.total;
      cumConcluidos += d.concluidos;
      cumViolados += d.violados;
      return {
        date: day,
        label: format(parseISO(day), 'dd/MM', { locale: ptBR }),
        total: cumTotal,
        concluidos: cumConcluidos,
        violados: cumViolados,
        pctCumprido: cumTotal > 0 ? Math.round((cumConcluidos / cumTotal) * 100) : 0,
        pctViolado: cumTotal > 0 ? Math.round((cumViolados / cumTotal) * 100) : 0,
      };
    });
  }, [slas]);

  if (loading) {
    return (
      <Card className="card-premium animate-fade-in">
        <CardHeader className="p-6 pb-4"><Skeleton className="h-5 w-48" /></CardHeader>
        <CardContent className="p-6 pt-0"><Skeleton className="h-48 rounded-xl" /></CardContent>
      </Card>
    );
  }

  if (chartData.length < 2) return null;

  return (
    <Card className="card-premium animate-fade-in overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between p-6 pb-4 border-b border-border/40 bg-muted/20">
        <div>
          <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1.5 flex items-center gap-1.5">
            <Timer className="w-3 h-3" />
            Evolução
          </p>
          <CardTitle className="text-base lg:text-xl font-bold">Cumprimento de SLA</CardTitle>
        </div>
        <button
          onClick={() => navigate('/gestor/sla')}
          className="h-9 px-4 rounded-xl bg-primary/10 text-[11px] font-bold tracking-wide text-primary hover:bg-primary hover:text-white transition-all duration-300 flex items-center gap-1.5"
        >
          Gestão <ArrowUpRight className="w-3 h-3" />
        </button>
      </CardHeader>

      <CardContent className="p-4 lg:p-6">
        <div className="h-56 lg:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradCumprido" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradViolado" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as DayPoint;
                  return (
                    <div className="bg-popover border border-border rounded-lg p-3 shadow-xl text-xs space-y-1">
                      <p className="font-bold text-foreground">{format(parseISO(d.date), "dd 'de' MMMM", { locale: ptBR })}</p>
                      <p className="text-success font-semibold">✅ Cumprido: {d.pctCumprido}% ({d.concluidos}/{d.total})</p>
                      <p className="text-destructive font-semibold">❌ Violado: {d.pctViolado}% ({d.violados}/{d.total})</p>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="pctCumprido"
                stroke="hsl(var(--success))"
                strokeWidth={2}
                fill="url(#gradCumprido)"
                name="Cumprido"
              />
              <Area
                type="monotone"
                dataKey="pctViolado"
                stroke="hsl(var(--destructive))"
                strokeWidth={2}
                fill="url(#gradViolado)"
                name="Violado"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 rounded-full bg-success" />
            <span className="text-[10px] font-semibold text-muted-foreground">% Cumprido</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 rounded-full bg-destructive" />
            <span className="text-[10px] font-semibold text-muted-foreground">% Violado</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
