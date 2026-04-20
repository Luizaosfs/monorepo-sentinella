import {
  useExecutivoKpis,
  useExecutivoTendencia,
  useExecutivoCobertura,
  useExecutivoBairrosVariacao,
  useExecutivoComparativoCiclos,
  useCoberturaAgregada,
  deltaPositivo,
} from '@/hooks/queries/usePainelExecutivo';
import { gerarPainelExecutivoPdf } from '@/lib/painelExecutivoPdf';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileDown,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  Users,
  MapPin,
  Activity,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreBadgeColor(score: number | null | undefined): string {
  if (score == null) return 'bg-gray-100 text-gray-600';
  if (score > 70) return 'bg-red-100 text-red-700';
  if (score > 50) return 'bg-orange-100 text-orange-700';
  if (score > 30) return 'bg-yellow-100 text-yellow-700';
  return 'bg-green-100 text-green-700';
}

function scoreLabel(score: number | null | undefined): string {
  if (score == null) return '—';
  if (score > 70) return 'Crítico';
  if (score > 50) return 'Alto';
  if (score > 30) return 'Médio';
  return 'Baixo';
}

function TendenciaChip({ value }: { value: string }) {
  if (value === 'piorando')
    return (
      <span className="inline-flex items-center gap-1 text-red-600 font-medium text-xs">
        <TrendingUp className="h-3 w-3" /> Piorando
      </span>
    );
  if (value === 'melhorando')
    return (
      <span className="inline-flex items-center gap-1 text-green-600 font-medium text-xs">
        <TrendingDown className="h-3 w-3" /> Melhorando
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
      <Minus className="h-3 w-3" /> Estável
    </span>
  );
}

function VariacaoBadge({
  atual,
  anterior,
  menorMelhor = false,
}: {
  atual: number | null | undefined;
  anterior: number | null | undefined;
  menorMelhor?: boolean;
}) {
  if (atual == null || anterior == null || anterior === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  const pct = (((atual - anterior) / anterior) * 100).toFixed(1);
  const num = parseFloat(pct);
  const isPositive = num > 0;
  const isBetter = menorMelhor ? !isPositive : isPositive;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
        isBetter ? 'text-green-600' : 'text-red-600'
      }`}
    >
      {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isPositive ? '+' : ''}{pct}%
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  secondary,
  icon: Icon,
  iconColor,
  loading,
}: {
  title: string;
  value: React.ReactNode;
  secondary?: React.ReactNode;
  icon?: React.ElementType;
  iconColor?: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {Icon && <Icon className={`h-4 w-4 ${iconColor ?? 'text-muted-foreground'}`} />}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
        {secondary && !loading && (
          <p className="text-muted-foreground text-sm mt-1">{secondary}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PainelExecutivo() {
  const { clientes, clienteId } = useClienteAtivo();
  const municipioNome = clientes.find((c) => c.id === clienteId)?.nome ?? 'Município';

  const { data: kpis, isLoading: kpisLoading, refetch } = useExecutivoKpis();
  const { data: tendencia = [] } = useExecutivoTendencia();
  const { data: cobertura = [] } = useExecutivoCobertura();
  const { data: bairrosVariacao = [] } = useExecutivoBairrosVariacao();
  const { data: comparativo } = useExecutivoComparativoCiclos();
  const coberturaAgregada = useCoberturaAgregada();

  const semanaLabel = kpis?.semana_ref
    ? (() => {
        try {
          return format(new Date(kpis.semana_ref), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
        } catch {
          return kpis.semana_ref;
        }
      })()
    : '—';

  const handleExportPdf = () => {
    gerarPainelExecutivoPdf({
      municipio: municipioNome,
      semanaRef: kpis?.semana_ref ?? new Date().toISOString(),
      kpis: kpis ?? null,
      tendencia,
      cobertura,
      bairrosVariacao,
      comparativo: comparativo ?? null,
    });
  };

  // ─── Render ───
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Painel Executivo Municipal</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Visão estratégica da semana de {semanaLabel}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Atualizar
          </Button>
          <Button size="sm" onClick={handleExportPdf}>
            <FileDown className="h-4 w-4 mr-1.5" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* KPI Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Focos Ativos"
          value={kpis?.total_focos_ativos ?? '—'}
          secondary={
            <span className="flex items-center gap-1">
              {(kpis?.focos_novos_semana ?? 0) > (kpis?.focos_resolvidos_semana ?? 0) && (
                <TrendingUp className="h-3 w-3 text-red-500" />
              )}
              {kpis?.focos_novos_semana ?? 0} novos esta semana
            </span>
          }
          icon={Activity}
          iconColor="text-red-500"
          loading={kpisLoading}
        />
        <KpiCard
          title="Taxa de Resolução"
          value={kpis?.taxa_resolucao_pct != null ? `${kpis.taxa_resolucao_pct}%` : '—'}
          secondary={
            <span className={(kpis?.taxa_resolucao_pct ?? 0) > 60 ? 'text-green-600' : ''}>
              {kpis?.focos_resolvidos_semana ?? 0} resolvidos
            </span>
          }
          icon={CheckCircle2}
          iconColor={
            (kpis?.taxa_resolucao_pct ?? 0) > 60 ? 'text-green-500' : 'text-muted-foreground'
          }
          loading={kpisLoading}
        />
        <KpiCard
          title="SLA Conformidade"
          value={kpis?.sla_conformidade_pct != null ? `${kpis.sla_conformidade_pct}%` : '—'}
          secondary={
            <span className={(kpis?.slas_vencidos ?? 0) > 0 ? 'text-red-600' : ''}>
              {kpis?.slas_vencidos ?? 0} vencidos
            </span>
          }
          icon={AlertTriangle}
          iconColor={(kpis?.slas_vencidos ?? 0) > 0 ? 'text-red-500' : 'text-muted-foreground'}
          loading={kpisLoading}
        />
        <KpiCard
          title="Cobertura Territorial"
          value={kpis?.cobertura_pct != null ? `${kpis.cobertura_pct}%` : '—'}
          secondary={`${kpis?.imoveis_visitados_semana ?? 0} imóveis visitados`}
          icon={MapPin}
          loading={kpisLoading}
        />
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Score Médio
            </CardTitle>
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{kpis?.score_medio ?? '—'}</div>
                <span
                  className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${scoreBadgeColor(kpis?.score_medio)}`}
                >
                  {scoreLabel(kpis?.score_medio)}
                </span>
              </>
            )}
          </CardContent>
        </Card>

        <KpiCard
          title="Imóveis Críticos"
          value={kpis?.imoveis_criticos ?? '—'}
          secondary={
            (kpis?.imoveis_criticos ?? 0) > 0 ? (
              <span className="flex items-center gap-1 text-red-600">
                <AlertTriangle className="h-3 w-3" /> score crítico ou muito alto
              </span>
            ) : (
              'score crítico ou muito alto'
            )
          }
          icon={AlertTriangle}
          iconColor={(kpis?.imoveis_criticos ?? 0) > 0 ? 'text-red-500' : 'text-muted-foreground'}
          loading={kpisLoading}
        />
        <KpiCard
          title="Casos Notificados"
          value={kpis?.casos_novos_semana ?? '—'}
          secondary="novos esta semana"
          loading={kpisLoading}
        />
        <KpiCard
          title="Agentes Ativos"
          value={kpis?.agentes_ativos_semana ?? '—'}
          secondary="em campo esta semana"
          icon={Users}
          loading={kpisLoading}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tendencia">
        <TabsList className="mb-4">
          <TabsTrigger value="tendencia">Tendência</TabsTrigger>
          <TabsTrigger value="cobertura">Cobertura</TabsTrigger>
          <TabsTrigger value="bairros">Bairros</TabsTrigger>
          <TabsTrigger value="ciclos">Ciclos</TabsTrigger>
        </TabsList>

        {/* ── Tab Tendência ── */}
        <TabsContent value="tendencia">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evolução semanal — últimas 8 semanas</CardTitle>
            </CardHeader>
            <CardContent>
              {tendencia.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">
                  Sem dados suficientes para exibir tendência.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={tendencia} margin={{ top: 4, right: 8, left: -8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="semana_inicio"
                      tickFormatter={(v: string) => {
                        try { return format(new Date(v), 'dd/MM', { locale: ptBR }); }
                        catch { return v; }
                      }}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      labelFormatter={(v: string) => {
                        try { return format(new Date(v), "dd/MM/yyyy", { locale: ptBR }); }
                        catch { return v; }
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="focos_novos"
                      name="Focos novos"
                      stroke="#dc2626"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="focos_resolvidos"
                      name="Resolvidos"
                      stroke="#16a34a"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="vistorias"
                      name="Vistorias"
                      stroke="#2563eb"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="casos"
                      name="Casos"
                      stroke="#ea580c"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab Cobertura ── */}
        <TabsContent value="cobertura">
          <div className="space-y-4">
            {/* Summary row */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold">{coberturaAgregada?.totalImoveis ?? '—'}</div>
                  <p className="text-muted-foreground text-sm">Total de imóveis</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold">{coberturaAgregada?.visitados30d ?? '—'}</div>
                  <p className="text-muted-foreground text-sm">Visitados (30d)</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold">
                    {coberturaAgregada?.bairrosEmRisco ?? '—'}
                  </div>
                  <p className="text-muted-foreground text-sm">Bairros com cobertura &lt; 50%</p>
                </CardContent>
              </Card>
            </div>

            {/* Bar chart */}
            {cobertura.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top bairros por focos ativos</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={[...cobertura].sort((a, b) => (b.focos_ativos ?? 0) - (a.focos_ativos ?? 0)).slice(0, 15)}
                      margin={{ top: 4, right: 8, left: -8, bottom: 50 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="bairro"
                        tick={{ fontSize: 10 }}
                        angle={-45}
                        textAnchor="end"
                        tickFormatter={(v: string) => v.length > 10 ? v.slice(0, 10) + '…' : v}
                      />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="focos_ativos" name="Focos ativos" fill="#dc2626" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="imoveis_criticos" name="Imóveis críticos" fill="#ea580c" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Table */}
            {cobertura.length > 0 && (
              <Card>
                <CardContent className="pt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground text-xs uppercase">
                        <th className="text-left py-2 pr-4">Bairro</th>
                        <th className="text-right py-2 pr-4">Imóveis</th>
                        <th className="text-right py-2 pr-4">Cobertura %</th>
                        <th className="text-right py-2 pr-4">Score Médio</th>
                        <th className="text-right py-2">Focos Ativos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cobertura.map((c) => (
                        <tr key={c.bairro} className="border-b last:border-0 hover:bg-muted/40">
                          <td className="py-2 pr-4 font-medium">{c.bairro}</td>
                          <td className="py-2 pr-4 text-right">{c.total_imoveis ?? 0}</td>
                          <td className="py-2 pr-4 text-right">
                            <span
                              className={`font-medium ${
                                (c.cobertura_pct ?? 0) >= 70
                                  ? 'text-green-600'
                                  : (c.cobertura_pct ?? 0) >= 40
                                  ? 'text-yellow-600'
                                  : 'text-red-600'
                              }`}
                            >
                              {c.cobertura_pct != null ? `${c.cobertura_pct}%` : '—'}
                            </span>
                          </td>
                          <td className="py-2 pr-4 text-right">{c.score_medio_bairro ?? '—'}</td>
                          <td className="py-2 text-right font-semibold">
                            {(c.focos_ativos ?? 0) > 0 ? (
                              <span className="text-red-600">{c.focos_ativos}</span>
                            ) : (
                              c.focos_ativos ?? 0
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ── Tab Bairros ── */}
        <TabsContent value="bairros">
          <Card>
            <CardContent className="pt-4 overflow-x-auto">
              {bairrosVariacao.length === 0 ? (
                <p className="text-muted-foreground text-sm py-8 text-center">
                  Sem dados de variação por bairro disponíveis.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs uppercase">
                      <th className="text-left py-2 pr-4">Bairro</th>
                      <th className="text-right py-2 pr-4">Score</th>
                      <th className="text-left py-2 pr-4">Tendência</th>
                      <th className="text-right py-2 pr-4">Focos 7d</th>
                      <th className="text-right py-2 pr-4">Focos 30d</th>
                      <th className="text-right py-2 pr-4">Casos 30d</th>
                      <th className="text-right py-2">Vistorias 30d</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...bairrosVariacao]
                      .sort((a, b) => (b.score_atual ?? 0) - (a.score_atual ?? 0))
                      .map((b) => (
                        <tr key={b.bairro} className="border-b last:border-0 hover:bg-muted/40">
                          <td className="py-2 pr-4 font-medium">{b.bairro}</td>
                          <td className="py-2 pr-4 text-right">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${scoreBadgeColor(b.score_atual)}`}>
                              {b.score_atual ?? '—'}
                            </span>
                          </td>
                          <td className="py-2 pr-4">
                            <TendenciaChip value={b.classificacao_tendencia} />
                          </td>
                          <td className="py-2 pr-4 text-right">{b.focos_novos_7d ?? 0}</td>
                          <td className="py-2 pr-4 text-right">{b.focos_novos_30d ?? 0}</td>
                          <td className="py-2 pr-4 text-right">{b.casos_30d ?? 0}</td>
                          <td className="py-2 text-right">{b.vistorias_30d ?? 0}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab Ciclos ── */}
        <TabsContent value="ciclos">
          <Card>
            <CardContent className="pt-4">
              {!comparativo ? (
                <p className="text-muted-foreground text-sm py-8 text-center">
                  Dados insuficientes para comparação de ciclos.
                </p>
              ) : (
                (() => {
                  const fmtCiclo = (d: string | null | undefined) => {
                    if (!d) return '—';
                    try { return format(new Date(d), 'MMM yyyy', { locale: ptBR }); }
                    catch { return d; }
                  };

                  const cicloAtual = fmtCiclo(comparativo.ciclo_atual_inicio);
                  const cicloAnterior = fmtCiclo(comparativo.ciclo_anterior_inicio);

                  type MetricaDef = {
                    label: string;
                    atual: number | null | undefined;
                    anterior: number | null | undefined;
                    menorMelhor: boolean;
                  };

                  const metricas: MetricaDef[] = [
                    {
                      label: 'Focos identificados',
                      atual: comparativo.focos_atual,
                      anterior: comparativo.focos_anterior,
                      menorMelhor: true,
                    },
                    {
                      label: 'Focos resolvidos',
                      atual: comparativo.resolucao_atual,
                      anterior: comparativo.resolucao_anterior,
                      menorMelhor: false,
                    },
                    {
                      label: 'Vistorias realizadas',
                      atual: comparativo.vistorias_atual,
                      anterior: comparativo.vistorias_anterior,
                      menorMelhor: false,
                    },
                    {
                      label: 'Casos notificados',
                      atual: comparativo.casos_atual,
                      anterior: comparativo.casos_anterior,
                      menorMelhor: true,
                    },
                  ];

                  return (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground text-xs uppercase">
                          <th className="text-left py-2 pr-4">Métrica</th>
                          <th className="text-right py-2 pr-4">{cicloAtual}</th>
                          <th className="text-right py-2 pr-4">{cicloAnterior}</th>
                          <th className="text-right py-2">Variação %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metricas.map((m) => (
                          <tr key={m.label} className="border-b last:border-0 hover:bg-muted/40">
                            <td className="py-2.5 pr-4 font-medium">{m.label}</td>
                            <td className="py-2.5 pr-4 text-right font-semibold">
                              {m.atual ?? '—'}
                            </td>
                            <td className="py-2.5 pr-4 text-right text-muted-foreground">
                              {m.anterior ?? '—'}
                            </td>
                            <td className="py-2.5 text-right">
                              <VariacaoBadge
                                atual={m.atual}
                                anterior={m.anterior}
                                menorMelhor={m.menorMelhor}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer note */}
      <p className="text-xs text-muted-foreground text-center pb-2">
        Dados atualizados automaticamente a cada 5 minutos. Fonte: Sentinella — Sistema de Vigilância Epidemiológica.
      </p>
    </div>
  );
}
