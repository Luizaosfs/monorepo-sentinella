import { useMemo } from 'react';
import { PlusCircle, Stethoscope, Activity, CheckCircle2, XCircle, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { useAuth } from '@/hooks/useAuth';
import { useCasosNotificados } from '@/hooks/queries/useCasosNotificados';
import { CasoNotificado } from '@/types/database';

const DOENCA_LABEL: Record<string, string> = {
  dengue: 'Dengue',
  chikungunya: 'Chikungunya',
  zika: 'Zika',
  suspeito: 'Suspeito',
};

const DOENCA_COLOR: Record<string, string> = {
  dengue: '#f97316',
  chikungunya: '#a855f7',
  zika: '#3b82f6',
  suspeito: '#94a3b8',
};

const STATUS_COLOR: Record<string, string> = {
  suspeito: '#f59e0b',
  confirmado: '#ef4444',
  descartado: '#94a3b8',
};

function semanaEpidemiologica(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - start.getTime();
  return Math.ceil((diff / 86400000 + start.getDay() + 1) / 7);
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000);
}

function formatDate(d: Date) {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export default function NotificadorHome() {
  const { clienteId } = useClienteAtivo();
  const { usuario } = useAuth();
  const { data: todos = [], isLoading } = useCasosNotificados(clienteId);

  // Últimos 30 dias
  const corte30 = daysAgo(30);
  const casos30 = useMemo(
    () => todos.filter(c => new Date(c.created_at) >= corte30),
    [todos],
  );

  // Casos do próprio notificador (últimos 30 dias)
  const meusCasos = useMemo(
    () => casos30
      .filter(c => c.notificador_id === usuario?.id || !c.notificador_id)
      .slice(0, 5),
    [casos30, usuario?.id],
  );

  // KPIs
  const totalSemana = useMemo(() => {
    const corte7 = daysAgo(7);
    return todos.filter(c => new Date(c.created_at) >= corte7).length;
  }, [todos]);
  const confirmados = casos30.filter(c => c.status === 'confirmado').length;
  const suspeitos   = casos30.filter(c => c.status === 'suspeito').length;
  const descartados = casos30.filter(c => c.status === 'descartado').length;

  // Pizza: distribuição por doença
  const pieData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of casos30) counts[c.doenca] = (counts[c.doenca] || 0) + 1;
    return Object.entries(counts).map(([doenca, value]) => ({ doenca, value }));
  }, [casos30]);

  // Barras: casos por dia (últimos 14 dias)
  const barData = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = daysAgo(13 - i);
      return { label: formatDate(d), date: d, total: 0 };
    });
    for (const c of todos) {
      const d = new Date(c.created_at);
      const idx = days.findIndex(
        day =>
          day.date.getDate() === d.getDate() &&
          day.date.getMonth() === d.getMonth(),
      );
      if (idx >= 0) days[idx].total++;
    }
    return days;
  }, [todos]);

  const seAtual = semanaEpidemiologica(new Date());
  const nome = usuario?.nome?.split(' ')[0] || 'Notificador';

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-card border-b px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Olá, {nome}</h1>
            <p className="text-xs text-muted-foreground">Semana epidemiológica {seAtual}</p>
          </div>
          <Button asChild size="sm" className="gap-1.5 rounded-xl h-9">
            <Link to="/notificador/registrar">
              <PlusCircle className="h-4 w-4" />
              Registrar
            </Link>
          </Button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-5">

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="rounded-2xl">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                {isLoading ? <Skeleton className="h-7 w-12" /> : (
                  <p className="text-2xl font-black">{totalSemana}</p>
                )}
                <p className="text-xs text-muted-foreground">Últimos 7 dias</p>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950">
                <Activity className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                {isLoading ? <Skeleton className="h-7 w-12" /> : (
                  <p className="text-2xl font-black text-amber-600">{suspeitos}</p>
                )}
                <p className="text-xs text-muted-foreground">Suspeitos (30d)</p>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950">
                <CheckCircle2 className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                {isLoading ? <Skeleton className="h-7 w-12" /> : (
                  <p className="text-2xl font-black text-rose-600">{confirmados}</p>
                )}
                <p className="text-xs text-muted-foreground">Confirmados (30d)</p>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-muted">
                <XCircle className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                {isLoading ? <Skeleton className="h-7 w-12" /> : (
                  <p className="text-2xl font-black text-muted-foreground">{descartados}</p>
                )}
                <p className="text-xs text-muted-foreground">Descartados (30d)</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gráfico de barras — casos por dia */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">Casos por dia — últimas 2 semanas</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            {isLoading ? (
              <Skeleton className="h-40 w-full rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={barData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
                    interval={1}
                  />
                  <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                    formatter={(v: number) => [v, 'Casos']}
                  />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Pizza — distribuição por doença */}
        {!isLoading && pieData.length > 0 && (
          <Card className="rounded-2xl">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">Distribuição por doença (30 dias)</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      innerRadius={30}
                      outerRadius={55}
                      paddingAngle={3}
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.doenca} fill={DOENCA_COLOR[entry.doenca] ?? '#94a3b8'} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ fontSize: 11, borderRadius: 8 }}
                      formatter={(v: number, _n: string, props: { payload?: { doenca?: string } }) => [
                        v,
                        DOENCA_LABEL[props.payload?.doenca ?? ''] ?? props.payload?.doenca,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2">
                  {pieData.map((entry) => (
                    <div key={entry.doenca} className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: DOENCA_COLOR[entry.doenca] ?? '#94a3b8' }}
                      />
                      <span className="text-xs text-muted-foreground">{DOENCA_LABEL[entry.doenca]}</span>
                      <span className="text-xs font-bold ml-auto">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Últimos casos registrados */}
        <Card className="rounded-2xl">
          <CardHeader className="pb-2 pt-4 px-4 flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Meus registros recentes</CardTitle>
            <span className="text-xs text-muted-foreground">{meusCasos.length} caso{meusCasos.length !== 1 ? 's' : ''}</span>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 rounded-xl" />)}
              </div>
            ) : meusCasos.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-xs">
                <Stethoscope className="h-8 w-8 mx-auto mb-2 opacity-30" />
                Nenhum caso registrado ainda
              </div>
            ) : (
              <div className="space-y-2">
                {meusCasos.map((caso: CasoNotificado) => (
                  <div
                    key={caso.id}
                    className="flex items-center gap-3 rounded-xl border bg-muted/30 px-3 py-2.5"
                  >
                    <div
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: STATUS_COLOR[caso.status] }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">
                        {DOENCA_LABEL[caso.doenca]} — {caso.bairro || 'sem bairro'}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(caso.data_notificacao).toLocaleDateString('pt-BR')}
                        {caso.unidade_saude?.nome && ` · ${caso.unidade_saude.nome}`}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[9px] font-bold uppercase shrink-0"
                      style={{ color: STATUS_COLOR[caso.status], borderColor: STATUS_COLOR[caso.status] + '60' }}
                    >
                      {caso.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
