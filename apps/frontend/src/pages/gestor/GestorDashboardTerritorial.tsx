import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { LatLngBounds } from 'leaflet';
import {
  AlertTriangle, Map, BarChart2, ShieldAlert, Droplets,
  Bug, Activity, RefreshCw, Filter, X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useDashboardTerritorial } from '@/hooks/queries/useDashboardTerritorial';
import type {
  DashboardTerritorialParams,
  DashboardTerritorialPontoMapa,
  DashboardTerritorialFatoresRisco,
} from '@/types/dashboardTerritorial';

// ─── Constantes ───────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  suspeita: '#f59e0b',
  em_triagem: '#fb923c',
  aguarda_inspecao: '#60a5fa',
  em_inspecao: '#f97316',
  confirmado: '#ef4444',
  em_tratamento: '#a855f7',
  resolvido: '#22c55e',
  descartado: '#9ca3af',
};

const STATUS_LABEL: Record<string, string> = {
  suspeita: 'Suspeita',
  em_triagem: 'Em triagem',
  aguarda_inspecao: 'Aguarda inspeção',
  em_inspecao: 'Em inspeção',
  confirmado: 'Confirmado',
  em_tratamento: 'Em tratamento',
  resolvido: 'Resolvido',
  descartado: 'Descartado',
};

const PRIORIDADE_STATUS_OPTIONS = ['P1', 'P2', 'P3', 'P4', 'P5'] as const;

const STATUS_OPTIONS = Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[];

const FATOR_LABEL: Record<keyof DashboardTerritorialFatoresRisco, string> = {
  menorIncapaz: 'Menor incapaz',
  idosoIncapaz: 'Idoso incapaz',
  depQuimico: 'Depósito químico',
  riscoAlimentar: 'Risco alimentar',
  riscoMoradia: 'Risco de moradia',
  criadouroAnimais: 'Criadouro de animais',
  lixo: 'Lixo acumulado',
  residuosOrganicos: 'Resíduos orgânicos',
  animaisSinaisLv: 'Animais com sinais de LV',
  caixaDestampada: "Caixa d'água destampada",
  mobilidadeReduzida: 'Mobilidade reduzida',
  acamado: 'Acamado',
};

// ─── Componente auxiliar de mapa ──────────────────────────────────────────────

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    // Leaflet não sabe o tamanho real do container até o CSS estar aplicado
    const t = setTimeout(() => map.invalidateSize(), 50);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

function AutoFitBounds({ points }: { points: DashboardTerritorialPontoMapa[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const bounds = new LatLngBounds(points.map((p) => [p.latitude, p.longitude] as [number, number]));
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 });
  }, [map, points]);
  return null;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  urgent,
  loading,
}: {
  title: string;
  value: number | null | undefined;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  urgent?: boolean;
  loading?: boolean;
}) {
  return (
    <Card
      className={cn(
        'border-border/60',
        urgent && value && value > 0 && 'border-red-300 bg-red-50/40 dark:bg-red-950/20',
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
          <Icon
            className={cn(
              'h-4 w-4 shrink-0',
              urgent && value && value > 0 ? 'text-red-500' : 'text-muted-foreground',
            )}
          />
        </div>
        {loading ? (
          <Skeleton className="h-8 w-16 mt-2" />
        ) : (
          <div className="mt-2">
            <span
              className={cn(
                'text-3xl font-bold tabular-nums',
                urgent && value && value > 0 ? 'text-red-600' : 'text-foreground',
              )}
            >
              {value ?? 0}
            </span>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function GestorDashboardTerritorial() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    dataInicio: '',
    dataFim: '',
    bairro: '',
    prioridade: '',
    status: '',
  });

  const [params, setParams] = useState<DashboardTerritorialParams>({});

  const { data, isLoading, isError, refetch } = useDashboardTerritorial(params);

  const aplicar = () => {
    setParams({
      dataInicio: form.dataInicio || undefined,
      dataFim: form.dataFim || undefined,
      bairro: form.bairro.trim() || undefined,
      prioridade: form.prioridade || undefined,
      status: form.status || undefined,
    });
  };

  const limpar = () => {
    setForm({ dataInicio: '', dataFim: '', bairro: '', prioridade: '', status: '' });
    setParams({});
  };

  const mapCenter = useMemo<[number, number]>(() => {
    const pts = data?.pontosMapa ?? [];
    if (pts.length === 0) return [-15.8, -47.9];
    const lat = pts.reduce((s, p) => s + p.latitude, 0) / pts.length;
    const lng = pts.reduce((s, p) => s + p.longitude, 0) / pts.length;
    return [lat, lng];
  }, [data?.pontosMapa]);

  const fatoresAtivos = useMemo(() => {
    if (!data?.fatoresRisco) return [];
    return (Object.entries(data.fatoresRisco) as [keyof DashboardTerritorialFatoresRisco, number][])
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a);
  }, [data?.fatoresRisco]);

  const temFiltrosAtivos = Object.values(params).some(Boolean);

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard Territorial</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão consolidada dos focos, vistorias e vulnerabilidades do território
          </p>
          {data?.meta.periodoInicio && (
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              Período: {data.meta.periodoInicio} → {data.meta.periodoFim}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="shrink-0"
        >
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Atualizar
        </Button>
      </div>

      {/* Filtros */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">Data início</label>
              <input
                type="date"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.dataInicio}
                onChange={(e) => setForm((f) => ({ ...f, dataInicio: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">Data fim</label>
              <input
                type="date"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.dataFim}
                onChange={(e) => setForm((f) => ({ ...f, dataFim: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">Bairro</label>
              <input
                type="text"
                placeholder="Ex: Centro"
                className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.bairro}
                onChange={(e) => setForm((f) => ({ ...f, bairro: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && aplicar()}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">Prioridade</label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.prioridade}
                onChange={(e) => setForm((f) => ({ ...f, prioridade: e.target.value }))}
              >
                <option value="">Todas</option>
                {PRIORIDADE_STATUS_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">Status</label>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="">Todos</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 ml-auto">
              {temFiltrosAtivos && (
                <Button variant="ghost" size="sm" onClick={limpar}>
                  <X className="h-4 w-4 mr-1" />
                  Limpar
                </Button>
              )}
              <Button size="sm" onClick={aplicar}>
                <Filter className="h-4 w-4 mr-1.5" />
                Aplicar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estado de erro */}
      {isError && (
        <Card className="border-red-200 bg-red-50/40">
          <CardContent className="p-4 text-center text-red-600 text-sm">
            Não foi possível carregar o dashboard territorial. Tente novamente.
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <KpiCard title="Focos totais" value={data?.kpis.totalFocos} icon={Activity} loading={isLoading} />
        <KpiCard title="Focos ativos" value={data?.kpis.focosAtivos} icon={AlertTriangle} loading={isLoading} urgent />
        <KpiCard title="Resolvidos" value={data?.kpis.focosResolvidos} icon={Activity} loading={isLoading} />
        <KpiCard
          title="Taxa de resolução"
          value={data?.kpis.taxaResolucaoPct != null ? Math.round(data.kpis.taxaResolucaoPct) : null}
          subtitle="%"
          icon={BarChart2}
          loading={isLoading}
        />
        <KpiCard title="Vistorias realizadas" value={data?.kpis.vistoriasRealizadas} icon={Activity} loading={isLoading} />
        <KpiCard title="SLA vencidos" value={data?.kpis.slaVencidos} icon={AlertTriangle} loading={isLoading} urgent />
        <KpiCard title="Calhas críticas" value={data?.kpis.calhasCriticas} icon={Droplets} loading={isLoading} urgent />
        <KpiCard title="Calhas tratadas" value={data?.kpis.calhasTratadas} icon={Droplets} loading={isLoading} />
      </div>

      {/* Mapa + Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Mapa */}
        <Card className="lg:col-span-3 border-border/60 overflow-hidden">
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Map className="h-4 w-4 text-muted-foreground" />
              Mapa operacional
              {data && (
                <Badge variant="secondary" className="ml-auto text-xs font-normal">
                  {data.meta.totalPontosMapa} pontos
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <Skeleton className="h-96 w-full rounded-none" />
            ) : !data?.pontosMapa.length ? (
              <div className="h-96 flex items-center justify-center text-sm text-muted-foreground">
                Sem pontos com coordenadas para o filtro selecionado.
              </div>
            ) : (
              <div style={{ height: '384px', width: '100%' }}>
                <MapContainer
                  center={mapCenter}
                  zoom={12}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  />
                  <MapResizer />
                  <AutoFitBounds points={data.pontosMapa} />
                  {data.pontosMapa.map((p) => (
                    <CircleMarker
                      key={p.id}
                      center={[p.latitude, p.longitude]}
                      radius={6 + p.peso}
                      pathOptions={{
                        color: STATUS_COLOR[p.status] ?? '#6b7280',
                        fillColor: STATUS_COLOR[p.status] ?? '#6b7280',
                        fillOpacity: 0.75,
                        weight: 1.5,
                      }}
                    >
                      <Popup>
                        <div className="text-xs space-y-1 min-w-[160px]">
                          <p className="font-semibold text-[11px] text-gray-500 uppercase tracking-wide">Foco</p>
                          <p className="font-mono text-[11px] text-gray-700 break-all">{p.id}</p>
                          <div className="flex gap-2 pt-1">
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                              style={{ background: STATUS_COLOR[p.status] ?? '#6b7280' }}
                            >
                              {STATUS_LABEL[p.status] ?? p.status}
                            </span>
                            {p.prioridade && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-700">
                                {p.prioridade}
                              </span>
                            )}
                          </div>
                          <button
                            className="mt-1 text-[11px] text-blue-600 underline underline-offset-2 hover:text-blue-800"
                            onClick={() => navigate(`/gestor/focos/${p.id}/relatorio`)}
                          >
                            Ver relatório →
                          </button>
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))}
                </MapContainer>
              </div>
            )}
            {data && (
              <p className="text-[10px] text-muted-foreground/60 px-3 py-1.5">
                Peso visual baseado em prioridade real — não é índice sanitário
              </p>
            )}
          </CardContent>
        </Card>

        {/* Rankings */}
        <div className="lg:col-span-2 space-y-4">
          {/* Ranking por bairro */}
          <Card className="border-border/60">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-semibold">Ranking por bairro</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                </div>
              ) : !data?.rankingBairro.length ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  Sem dados por bairro para o período.
                </p>
              ) : (
                <div className="space-y-1">
                  {data.rankingBairro.map((r) => (
                    <div key={r.bairro} className="flex items-center justify-between py-1 border-b border-border/40 last:border-0">
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{r.bairro}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {r.vistoriasRealizadas} vistoria{r.vistoriasRealizadas !== 1 ? 's' : ''}
                          {r.slaVencidos > 0 && ` · ${r.slaVencidos} SLA vencido${r.slaVencidos > 1 ? 's' : ''}`}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0 ml-2">
                        <span className={cn('text-xs font-bold tabular-nums', r.focosAtivos > 0 && 'text-red-600')}>
                          {r.focosAtivos}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">/ {r.totalFocos}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground/50 mt-3 leading-relaxed">
                rankingBairro usa imoveis.bairro textual; territorialização canônica por bairroId/regiaoId fica para fase posterior
              </p>
            </CardContent>
          </Card>

          {/* Ranking por região */}
          <Card className="border-border/60">
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-semibold">Ranking por região</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                </div>
              ) : !data?.rankingRegiao.length ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  Sem dados por região para o período.
                </p>
              ) : (
                <div className="space-y-1">
                  {data.rankingRegiao.map((r) => (
                    <div key={r.regiaoId} className="flex items-center justify-between py-1 border-b border-border/40 last:border-0">
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{r.regiaoNome}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {r.vistoriasRealizadas} vistoria{r.vistoriasRealizadas !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0 ml-2">
                        <span className={cn('text-xs font-bold tabular-nums', r.focosAtivos > 0 && 'text-red-600')}>
                          {r.focosAtivos}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">/ {r.totalFocos}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Depósitos PNCD + Fatores de risco */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Depósitos PNCD */}
        <Card className="border-border/60">
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Bug className="h-4 w-4 text-muted-foreground" />
              Depósitos PNCD
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : !data?.depositosPncd.porTipo.length ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Sem dados de depósitos.</p>
            ) : (
              <>
                {/* Totais */}
                <div className="grid grid-cols-4 gap-2 mb-4 pb-3 border-b border-border/40">
                  {[
                    { label: 'Inspecionados', value: data.depositosPncd.totais.inspecionados },
                    { label: 'Com foco', value: data.depositosPncd.totais.comFoco },
                    { label: 'Com água', value: data.depositosPncd.totais.comAgua },
                    { label: 'Eliminados', value: data.depositosPncd.totais.eliminados },
                  ].map(({ label, value }) => (
                    <div key={label} className="text-center">
                      <p className="text-lg font-bold tabular-nums">{value}</p>
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
                {/* Por tipo */}
                <div className="space-y-1">
                  {data.depositosPncd.porTipo.map((t) => (
                    <div key={t.tipo} className="grid grid-cols-5 gap-1 text-xs py-1 border-b border-border/30 last:border-0">
                      <span className="col-span-2 font-medium truncate">{t.tipo}</span>
                      <span className="text-center tabular-nums text-muted-foreground">{t.qtdInspecionados}</span>
                      <span className={cn('text-center tabular-nums', t.qtdComFocos > 0 && 'text-red-600 font-semibold')}>
                        {t.qtdComFocos}
                      </span>
                      <span className="text-center tabular-nums text-muted-foreground">{t.qtdEliminados}</span>
                    </div>
                  ))}
                  <div className="grid grid-cols-5 gap-1 text-[10px] text-muted-foreground/60 pt-1">
                    <span className="col-span-2">Tipo</span>
                    <span className="text-center">Insp.</span>
                    <span className="text-center">Foco</span>
                    <span className="text-center">Elim.</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Fatores de risco */}
        <Card className="border-border/60">
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-muted-foreground" />
              Fatores de risco predominantes
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : !fatoresAtivos.length ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                {data?.fatoresRisco === null
                  ? 'Sem vistorias com dados de risco no período.'
                  : 'Nenhum fator de risco registrado.'}
              </p>
            ) : (
              <div className="space-y-1.5">
                {fatoresAtivos.map(([key, count]) => {
                  const max = fatoresAtivos[0]?.[1] ?? 1;
                  const pct = Math.round((count / max) * 100);
                  return (
                    <div key={key} className="space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-foreground">{FATOR_LABEL[key]}</span>
                        <span className="text-xs font-semibold tabular-nums">{count}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-400 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Meta / observações */}
      {data?.meta && (
        <div className="text-[10px] text-muted-foreground/50 space-y-0.5 pt-2 border-t border-border/30">
          <p>Pontos no mapa: {data.meta.totalPontosMapa} (máx. 500)</p>
          <p>{data.meta.pesoMapaRegra}</p>
          {data.meta.observacoes.map((obs, i) => (
            <p key={i}>{obs}</p>
          ))}
        </div>
      )}
    </div>
  );
}
