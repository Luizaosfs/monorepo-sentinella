import { useQuery } from '@tanstack/react-query';
import { Bot, Download } from 'lucide-react';
import { toast } from 'sonner';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ListColumnHeader } from '@/components/ui/list-column-header';
import { cn } from '@/lib/utils';

interface YoloQualidadeResumo {
  precisao_estimada: number;
  taxa_falsos_positivos: number;
  total_correlacoes: number;
  cobertura: number;
  evolucao_mensal: { mes: string; precisao: number }[];
  correlacoes: {
    id: string;
    endereco: string;
    risco_drone: string;
    confirmado_campo: boolean | null;
    distancia_metros: number;
  }[];
}

function confirmacaoBadge(confirmado: boolean | null) {
  if (confirmado === true) {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 border">
        Confirmado
      </Badge>
    );
  }
  if (confirmado === false) {
    return (
      <Badge className="bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 border">
        Não confirmado
      </Badge>
    );
  }
  return (
    <Badge variant="secondary">
      Pendente
    </Badge>
  );
}

function exportarCsvRetreino(correlacoes: YoloQualidadeResumo['correlacoes']) {
  const header = ['levantamento_item_id', 'risco_drone', 'confirmado_campo'];
  const lines = correlacoes.map(c => [
    c.id,
    `"${c.risco_drone}"`,
    c.confirmado_campo == null ? '' : String(c.confirmado_campo),
  ].join(','));
  const csv = [header.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `yolo_retreino_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('CSV de re-treino exportado com sucesso');
}

export default function AdminYoloQualidade() {
  const { clienteId } = useClienteAtivo();

  const { data, isLoading } = useQuery<YoloQualidadeResumo>({
    queryKey: ['yolo_qualidade', clienteId],
    queryFn: () => api.yoloQualidade.resumo(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.MEDIUM,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Qualidade do Modelo Drone</h1>
            <p className="text-sm text-muted-foreground">
              Baseado em correlações drone × campo
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={!data?.correlacoes?.length}
          onClick={() => data?.correlacoes && exportarCsvRetreino(data.correlacoes)}
        >
          <Download className="h-4 w-4" />
          Exportar dados para re-treino (CSV)
        </Button>
      </div>

      {/* KPI cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'Precisão estimada',
              value: `${data.precisao_estimada.toFixed(1)}%`,
              color: data.precisao_estimada >= 80 ? 'text-emerald-600 dark:text-emerald-400' : data.precisao_estimada >= 60 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400',
            },
            {
              label: 'Taxa falsos positivos',
              value: `${data.taxa_falsos_positivos.toFixed(1)}%`,
              color: data.taxa_falsos_positivos <= 10 ? 'text-emerald-600 dark:text-emerald-400' : data.taxa_falsos_positivos <= 25 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400',
            },
            {
              label: 'Correlações registradas',
              value: String(data.total_correlacoes),
              color: 'text-foreground',
            },
            {
              label: 'Cobertura (%)',
              value: `${data.cobertura.toFixed(1)}%`,
              color: data.cobertura >= 70 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400',
            },
          ].map(kpi => (
            <Card key={kpi.label}>
              <CardHeader className="pb-1 pt-4">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {kpi.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <p className={cn('text-2xl font-bold tabular-nums', kpi.color)}>{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {/* Line chart */}
      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : data?.evolucao_mensal && data.evolucao_mensal.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolução Mensal da Precisão</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.evolucao_mensal} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" />
                <XAxis
                  dataKey="mes"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={v => `${v}%`}
                />
                <RechartsTooltip
                  formatter={(value: number) => [`${value.toFixed(1)}%`, 'Precisão']}
                  contentStyle={{ fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="precisao"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 4, fill: '#3b82f6' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : null}

      {/* Correlations table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Correlações Drone × Campo</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
            </div>
          ) : !data?.correlacoes?.length ? (
            <div className="p-10 text-center text-muted-foreground text-sm">
              Nenhuma correlação registrada ainda.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <ListColumnHeader label="Endereço" />
                  <ListColumnHeader label="Risco Drone" contentClassName="justify-center" />
                  <ListColumnHeader label="Campo Confirmou" contentClassName="justify-center" />
                  <ListColumnHeader label="Distância" contentClassName="justify-end" />
                </tr>
              </thead>
              <tbody>
                {data.correlacoes.map((c, idx) => (
                  <tr
                    key={c.id}
                    className={cn(
                      'border-b last:border-0 hover:bg-muted/20 transition-colors',
                      idx % 2 !== 0 && 'bg-muted/5'
                    )}
                  >
                    <td className="px-4 py-3 font-medium max-w-[240px] truncate" title={c.endereco}>
                      {c.endereco}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border',
                        c.risco_drone === 'Crítico' || c.risco_drone === 'Alto'
                          ? 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400'
                          : c.risco_drone === 'Moderado'
                          ? 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400'
                          : 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400'
                      )}>
                        {c.risco_drone}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {confirmacaoBadge(c.confirmado_campo)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {c.distancia_metros != null ? `${c.distancia_metros.toFixed(0)}m` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
