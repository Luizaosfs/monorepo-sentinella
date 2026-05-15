import { useState } from 'react';
import { PlusCircle, Stethoscope, Activity, CheckCircle2, XCircle, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { ListState } from '@/components/layout/ListState';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { useAuth } from '@/hooks/useAuth';
import { useNotificadorResumo } from '@/hooks/useNotificadorResumo';
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

const LIMITE_INICIAL = 5;

export default function NotificadorHome() {
  const { clienteId } = useClienteAtivo();
  const { usuario } = useAuth();
  const [verTodosCasos, setVerTodosCasos] = useState(false);

  const {
    isLoading,
    meusCasosTodos,
    totalSemana,
    suspeitos,
    confirmados,
    descartados,
    pieData,
    barData,
    semanaEpidemiologicaAtual,
  } = useNotificadorResumo(clienteId, usuario?.id);

  const meusCasos = verTodosCasos ? meusCasosTodos : meusCasosTodos.slice(0, LIMITE_INICIAL);
  const nome = usuario?.nome?.split(' ')[0] || 'Notificador';

  return (
    <PageShell className="pb-24">
      <PageHeader
        title={`Olá, ${nome}`}
        subtitle={`Semana epidemiológica ${semanaEpidemiologicaAtual}`}
        actions={
          <Button asChild size="sm" className="gap-1.5 rounded-xl h-9">
            <Link to="/notificador/registrar">
              <PlusCircle className="h-4 w-4" />
              Registrar
            </Link>
          </Button>
        }
      />

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
            <span className="text-xs text-muted-foreground">{meusCasosTodos.length} caso{meusCasosTodos.length !== 1 ? 's' : ''}</span>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <ListState
              isLoading={isLoading}
              isEmpty={meusCasos.length === 0}
              emptyIcon={<Stethoscope className="h-8 w-8 mx-auto mb-2 opacity-30" />}
              emptyText="Nenhum caso registrado ainda"
            >
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
                {meusCasosTodos.length > LIMITE_INICIAL && (
                  <button
                    type="button"
                    onClick={() => setVerTodosCasos(v => !v)}
                    className="w-full flex items-center justify-center gap-1 pt-1 text-xs text-primary font-medium"
                  >
                    {verTodosCasos ? (
                      <><ChevronUp className="h-3.5 w-3.5" /> Ver menos</>
                    ) : (
                      <><ChevronDown className="h-3.5 w-3.5" /> Ver todos ({meusCasosTodos.length})</>
                    )}
                  </button>
                )}
              </div>
            </ListState>
          </CardContent>
        </Card>

      </div>
    </PageShell>
  );
}
