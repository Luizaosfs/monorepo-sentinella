import { useState, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import L from '@/lib/leaflet';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { LatLngBounds } from 'leaflet';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as ChartTooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts';
import {
  AlertTriangle, Map, ShieldAlert,
  Activity, RefreshCw, Filter, X, Layers, Users,
  MapPin, CheckCircle, Clock, SlidersHorizontal, ChevronDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useDashboardTerritorial } from '@/hooks/queries/useDashboardTerritorial';
import type {
  DashboardTerritorialParams,
  DashboardTerritorialPontoMapa,
  DashboardTerritorialFatoresRisco,
  DashboardTerritorialDepositosPncd,
} from '@/types/dashboardTerritorial';

// ─── Constants ────────────────────────────────────────────────────────────────

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

const PRIORIDADE_OPTIONS = ['P1', 'P2', 'P3', 'P4', 'P5'] as const;
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

const RANK_BADGE_CLS = [
  'bg-yellow-400 text-yellow-900',
  'bg-slate-200 text-slate-600',
  'bg-amber-700 text-white',
] as const;

const DEPOSITO_COLORS = ['#2563eb', '#f59e0b', '#22c55e', '#8b5cf6'];

/** Paleta do mapa territorial (referência visual): primário + risco alto */
const PNCD_BARRA_INSPECIONADOS = '#3B82F6';
/** Vermelho “Crítico” da referência visual (#EF4444) */
const PNCD_BARRA_COM_FOCO = '#EF4444';

type VulnKey = 'idosoIncapaz' | 'menorIncapaz' | 'mobilidadeReduzida' | 'acamado';
const VULN_KEYS: VulnKey[] = ['idosoIncapaz', 'menorIncapaz', 'mobilidadeReduzida', 'acamado'];
const VULN_KEY_SET = new Set<string>(VULN_KEYS);

const VULN_META: Record<VulnKey, { label: string; icon: React.ComponentType<{ className?: string }>; iconCls: string }> = {
  idosoIncapaz:       { label: 'Idosos incapazes',  icon: Users,       iconCls: 'text-blue-500' },
  menorIncapaz:       { label: 'Menores incapazes', icon: Users,       iconCls: 'text-purple-500' },
  mobilidadeReduzida: { label: 'Mob. reduzida',     icon: Activity,    iconCls: 'text-orange-500' },
  acamado:            { label: 'Acamado',           icon: ShieldAlert, iconCls: 'text-red-500' },
};

// ─── Map helpers ──────────────────────────────────────────────────────────────

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 50);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

function AutoFitBounds({ points }: { points: DashboardTerritorialPontoMapa[] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const bounds = new LatLngBounds(points.map((p) => [p.latitude, p.longitude] as [number, number]));
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 });
  }, [map, points]);
  return null;
}

type HeatLayerInstance = L.Layer & { _canvas?: HTMLCanvasElement };

function TerritorialHeatmapLayer({ points }: { points: DashboardTerritorialPontoMapa[] }) {
  const map = useMap();
  const layerRef = useRef<HeatLayerInstance | null>(null);
  const [bounds, setBounds] = useState<L.LatLngBounds | null>(() => map?.getBounds() ?? null);

  useMapEvents({
    moveend: () => setBounds(map.getBounds()),
    zoomend: () => setBounds(map.getBounds()),
  });

  const heatPoints = useMemo(() => {
    const padded = bounds?.pad(0.2) ?? null;
    return points
      .filter((p) => !padded || padded.contains([p.latitude, p.longitude]))
      .map((p): [number, number, number] => [p.latitude, p.longitude, Math.min(p.peso / 5, 1)]);
  }, [points, bounds]);

  useEffect(() => {
    if (!map || !heatPoints.length) return;
    let cancelled = false;

    (async () => {
      await import('leaflet.heat');
      if (cancelled) return;
      type LWithHeat = typeof L & {
        heatLayer: (pts: [number, number, number][], opts: Record<string, unknown>) => HeatLayerInstance;
      };
      const heat = (L as unknown as LWithHeat).heatLayer(heatPoints, {
        radius: 22,
        blur: 18,
        maxZoom: 17,
        max: 1.0,
        gradient: { 0.2: '#4ade80', 0.5: '#facc15', 0.75: '#f97316', 1.0: '#ef4444' },
      });
      heat.addTo(map);
      if (heat._canvas) heat._canvas.style.opacity = '0.55';
      layerRef.current = heat;
    })();

    return () => {
      cancelled = true;
      if (layerRef.current) {
        layerRef.current.removeFrom(map);
        layerRef.current = null;
      }
    };
  }, [map, heatPoints]);

  return null;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  suffix,
  subtitle,
  icon: Icon,
  iconColor,
  urgent,
  loading,
}: {
  title: string;
  value: number | null | undefined;
  suffix?: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor?: string;
  urgent?: boolean;
  loading?: boolean;
}) {
  const isHot = urgent && !!value && value > 0;
  return (
    <div
      className={cn(
        'h-[120px] rounded-2xl bg-white border border-slate-200 shadow-sm p-5 flex flex-col justify-between',
        'transition-all duration-200 hover:shadow-md hover:scale-[1.02] cursor-default',
        isHot && 'border-red-200 bg-red-50/30',
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4 shrink-0', iconColor ?? 'text-slate-400', isHot && 'text-red-400')} />
        <span className="text-xs font-medium text-slate-500 truncate">{title}</span>
      </div>
      {loading ? (
        <Skeleton className="h-8 w-16" />
      ) : (
        <div>
          <p className={cn('text-3xl font-bold text-slate-900 tabular-nums leading-none', isHot && 'text-red-600')}>
            {value ?? 0}
            {suffix && <span className="text-xl font-normal text-slate-400 ml-0.5">{suffix}</span>}
          </p>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
      )}
    </div>
  );
}

// ─── PNCD Tooltip ─────────────────────────────────────────────────────────────

type PncdRow = { name: string; fullName: string; Insp: number; Foco: number };

function PncdTooltip({
  active,
  payload,
  label,
  rows,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
  rows: PncdRow[];
}) {
  if (!active || !payload?.length) return null;
  const row = rows.find((d) => d.name === label);
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs shadow-lg">
      <p className="font-semibold mb-1.5 text-slate-800">{row?.fullName ?? label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="flex items-center gap-2 text-slate-500">
          <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: entry.color ?? '#888' }} />
          {entry.name}: <span className="font-semibold text-slate-800">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

function SectionCard({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('bg-white rounded-2xl border border-slate-200 shadow-sm', className)}>
      <CardHeader className="pb-0 px-5 pt-5">
        <CardTitle className="text-sm font-semibold text-slate-800">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-3">{children}</CardContent>
    </Card>
  );
}

function DepositosDonut({
  depositos,
  loading,
}: {
  depositos?: DashboardTerritorialDepositosPncd;
  loading?: boolean;
}) {
  const rows = useMemo(() => {
    if (!depositos) return [];
    return [
      { name: 'Inspecionados', value: depositos.totais.inspecionados },
      { name: 'Com foco', value: depositos.totais.comFoco },
      { name: 'Eliminados', value: depositos.totais.eliminados },
      { name: 'Com água', value: depositos.totais.comAgua },
    ].filter((item) => item.value > 0);
  }, [depositos]);

  const total = rows.reduce((sum, item) => sum + item.value, 0);

  if (loading) return <Skeleton className="h-44 w-full rounded-xl" />;
  if (!total) return <p className="text-sm text-slate-400 py-6 text-center">Sem dados PNCD no período.</p>;

  return (
    <div className="grid w-full min-w-0 grid-cols-[minmax(0,120px)_minmax(0,1fr)] gap-3 sm:gap-4 items-center min-h-[150px]">
      <div className="relative h-[120px] min-w-0 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="value" nameKey="name" innerRadius={38} outerRadius={56} paddingAngle={3}>
              {rows.map((entry, index) => (
                <Cell key={entry.name} fill={DEPOSITO_COLORS[index % DEPOSITO_COLORS.length]} />
              ))}
            </Pie>
            <ChartTooltip
              formatter={(value, name) => [value, name]}
              contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0', fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-lg font-bold text-slate-900 tabular-nums">{depositos?.totais.inspecionados ?? 0}</span>
          <span className="text-[10px] text-slate-400">inspec.</span>
        </div>
      </div>
      <div className="min-w-0 space-y-2">
        {rows.map((item, index) => (
          <div key={item.name} className="flex min-w-0 items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-2 text-slate-500">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: DEPOSITO_COLORS[index % DEPOSITO_COLORS.length] }} />
              <span className="truncate">{item.name}</span>
            </span>
            <span className="shrink-0 font-semibold text-slate-700 tabular-nums">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResolutionGauge({ value, loading }: { value: number | null | undefined; loading?: boolean }) {
  if (loading) return <Skeleton className="h-40 w-full rounded-xl" />;
  if (value == null) return <p className="text-sm text-slate-400 py-6 text-center">Sem taxa calculada.</p>;

  const safeValue = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-5 min-w-0">
      <div
        className="relative h-28 w-28 shrink-0 rounded-full"
        style={{ background: `conic-gradient(#22c55e 0 ${safeValue}%, #fee2e2 ${safeValue}% 100%)` }}
      >
        <div className="absolute inset-2 flex flex-col items-center justify-center rounded-full bg-white px-1 text-center shadow-inner">
          <span className="whitespace-nowrap text-2xl font-bold leading-none tabular-nums text-slate-900">
            {safeValue.toFixed(0)}%
          </span>
          <span className="mt-0.5 whitespace-nowrap text-[9px] leading-tight text-slate-400">resolução</span>
        </div>
      </div>
      <div className="space-y-2 text-sm">
        <p className="font-semibold text-slate-800">Taxa de resolução</p>
        <p className="text-xs text-slate-500 leading-relaxed">
          Indicador calculado a partir dos focos resolvidos existentes no período selecionado.
        </p>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function GestorDashboardTerritorial() {
  const navigate = useNavigate();

  const [form, setForm] = useState({ dataInicio: '', dataFim: '', bairro: '', prioridade: '', status: '' });
  const [params, setParams] = useState<DashboardTerritorialParams>({});
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showFiltros, setShowFiltros] = useState(false);

  const { data, isLoading, isError, refetch } = useDashboardTerritorial(params);

  const aplicar = () => {
    setParams({
      dataInicio: form.dataInicio || undefined,
      dataFim: form.dataFim || undefined,
      bairro: form.bairro.trim() || undefined,
      prioridade: form.prioridade || undefined,
      status: form.status || undefined,
    });
    setShowFiltros(false);
  };

  const limpar = () => {
    setForm({ dataInicio: '', dataFim: '', bairro: '', prioridade: '', status: '' });
    setParams({});
  };

  const temFiltros = Object.values(params).some(Boolean);

  const mapCenter = useMemo<[number, number]>(() => {
    const pts = data?.pontosMapa ?? [];
    if (!pts.length) return [-15.8, -47.9];
    return [
      pts.reduce((s, p) => s + p.latitude, 0) / pts.length,
      pts.reduce((s, p) => s + p.longitude, 0) / pts.length,
    ];
  }, [data?.pontosMapa]);

  const totalVulneraveis = useMemo(() => {
    if (!data?.fatoresRisco) return null;
    return VULN_KEYS.reduce((sum, k) => sum + (data.fatoresRisco![k] ?? 0), 0);
  }, [data?.fatoresRisco]);

  const fatoresAtivos = useMemo(() => {
    if (!data?.fatoresRisco) return [];
    return (Object.entries(data.fatoresRisco) as [keyof DashboardTerritorialFatoresRisco, number][])
      .filter(([k, v]) => v > 0 && !VULN_KEY_SET.has(k))
      .sort(([, a], [, b]) => b - a);
  }, [data?.fatoresRisco]);

  const pncdChartData = useMemo<PncdRow[]>(
    () =>
      (data?.depositosPncd.porTipo ?? []).map((t) => ({
        name: t.tipo.length > 8 ? t.tipo.slice(0, 8) + '…' : t.tipo,
        fullName: t.tipo,
        Insp: t.qtdInspecionados,
        Foco: t.qtdComFocos,
      })),
    [data?.depositosPncd.porTipo],
  );

  return (
    <div className="bg-slate-50 min-h-full">
      <div className="max-w-[1500px] mx-auto px-6 py-6 space-y-6">

        {/* ── A) Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Mapa Territorial de Risco e Vulnerabilidade
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Painel estratégico para supervisão e tomada de decisão
            </p>
            {data?.meta.periodoInicio && (
              <p className="text-xs text-slate-400 mt-0.5">
                {data.meta.periodoInicio} → {data.meta.periodoFim}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFiltros((v) => !v)}
              className={cn(
                'rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50',
                temFiltros && 'border-blue-300 text-blue-600 bg-blue-50',
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
              Filtros
              {temFiltros && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />}
              <ChevronDown className={cn('h-3 w-3 ml-1 transition-transform', showFiltros && 'rotate-180')} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              className="rounded-xl border-slate-200 text-slate-600"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Atualizar
            </Button>
          </div>
        </div>

        {/* ── Filtros colapsáveis ── */}
        {showFiltros && (
          <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <CardContent className="p-5">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-500 font-medium">Data início</label>
                  <input
                    type="date"
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    value={form.dataInicio}
                    onChange={(e) => setForm((f) => ({ ...f, dataInicio: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-500 font-medium">Data fim</label>
                  <input
                    type="date"
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    value={form.dataFim}
                    onChange={(e) => setForm((f) => ({ ...f, dataFim: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-500 font-medium">Bairro</label>
                  <input
                    type="text"
                    placeholder="Ex: Centro"
                    className="h-8 w-36 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    value={form.bairro}
                    onChange={(e) => setForm((f) => ({ ...f, bairro: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && aplicar()}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-500 font-medium">Prioridade</label>
                  <select
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    value={form.prioridade}
                    onChange={(e) => setForm((f) => ({ ...f, prioridade: e.target.value }))}
                  >
                    <option value="">Todas</option>
                    {PRIORIDADE_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-500 font-medium">Status</label>
                  <select
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  >
                    <option value="">Todos</option>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                </div>
                <div className="flex gap-2 ml-auto">
                  {temFiltros && (
                    <Button variant="ghost" size="sm" onClick={limpar} className="rounded-lg text-slate-500">
                      <X className="h-3.5 w-3.5 mr-1" />
                      Limpar
                    </Button>
                  )}
                  <Button size="sm" onClick={aplicar} className="rounded-lg">
                    <Filter className="h-3.5 w-3.5 mr-1.5" />
                    Aplicar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Erro ── */}
        {isError && (
          <Card className="bg-red-50 border-red-200 rounded-2xl">
            <CardContent className="p-5 text-center text-red-600 text-sm">
              Não foi possível carregar o dashboard territorial. Tente novamente.
            </CardContent>
          </Card>
        )}

        {/* ── B) KPIs — 6 cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-5">
          <KpiCard
            title="Vistorias realizadas"
            value={data?.kpis.vistoriasRealizadas}
            subtitle="período selecionado"
            icon={Activity}
            iconColor="text-blue-500"
            loading={isLoading}
          />
          <KpiCard
            title="Focos registrados"
            value={data?.kpis.totalFocos}
            subtitle="total no período"
            icon={MapPin}
            iconColor="text-slate-400"
            loading={isLoading}
          />
          <KpiCard
            title="Focos ativos"
            value={data?.kpis.focosAtivos}
            subtitle="requerem atenção"
            icon={AlertTriangle}
            iconColor="text-orange-500"
            urgent
            loading={isLoading}
          />
          <KpiCard
            title="Focos resolvidos"
            value={data?.kpis.focosResolvidos}
            subtitle="no período"
            icon={CheckCircle}
            iconColor="text-emerald-500"
            loading={isLoading}
          />
          <KpiCard
            title="SLA vencidos"
            value={data?.kpis.slaVencidos}
            subtitle="prazo excedido"
            icon={Clock}
            iconColor="text-red-500"
            urgent
            loading={isLoading}
          />
          <KpiCard
            title="Grupos vulneráveis"
            value={totalVulneraveis}
            subtitle="pessoas em risco"
            icon={Users}
            iconColor="text-purple-500"
            loading={isLoading}
          />
        </div>

        {/* ── C) Grid principal inspirado no modelo: mapa amplo + cards laterais ── */}
        <div className="grid grid-cols-12 gap-5">

          {/* Mapa */}
          <Card className="col-span-12 xl:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="pb-0 px-5 pt-4">
              <div className="flex items-center gap-2">
                <Map className="h-4 w-4 text-slate-400 shrink-0" />
                <CardTitle className="text-sm font-semibold text-slate-700 flex-1">Mapa operacional de risco</CardTitle>
                {data && (
                  <span className="text-xs text-slate-400 tabular-nums">
                    {data.meta.totalPontosMapa} pontos
                  </span>
                )}
                <Button
                  variant={showHeatmap ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 px-2.5 text-xs gap-1.5 rounded-lg"
                  onClick={() => setShowHeatmap((v) => !v)}
                >
                  <Layers className="h-3.5 w-3.5" />
                  Heatmap
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0 mt-3">
              {isLoading ? (
                <Skeleton className="h-[500px] w-full rounded-none" />
              ) : !data?.pontosMapa.length ? (
                <div className="h-[500px] flex flex-col items-center justify-center gap-3 text-slate-400">
                  <Map className="h-12 w-12 opacity-10" />
                  <p className="text-sm">Sem pontos com coordenadas para o filtro selecionado.</p>
                </div>
              ) : (
                <div className="relative" style={{ height: '500px' }}>
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
                    {showHeatmap && <TerritorialHeatmapLayer points={data.pontosMapa} />}
                    {data.pontosMapa.map((p) => (
                      <CircleMarker
                        key={p.id}
                        center={[p.latitude, p.longitude]}
                        radius={4 + p.peso * 0.8}
                        pathOptions={{
                          color: STATUS_COLOR[p.status] ?? '#6b7280',
                          fillColor: STATUS_COLOR[p.status] ?? '#6b7280',
                          fillOpacity: showHeatmap ? 0.4 : 0.8,
                          weight: 1,
                        }}
                      >
                        <Popup>
                          <div className="text-xs space-y-1.5 min-w-[160px]">
                            <p className="font-mono text-[10px] text-gray-400 break-all">{p.id}</p>
                            <div className="flex flex-wrap gap-1.5">
                              <span
                                className="px-1.5 py-0.5 rounded-md text-[10px] font-medium text-white"
                                style={{ background: STATUS_COLOR[p.status] ?? '#6b7280' }}
                              >
                                {STATUS_LABEL[p.status] ?? p.status}
                              </span>
                              {p.prioridade && (
                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-700">
                                  {p.prioridade}
                                </span>
                              )}
                            </div>
                            <button
                              className="text-[11px] text-blue-600 hover:text-blue-800 underline underline-offset-2"
                              onClick={() => navigate(`/gestor/focos/${p.id}/relatorio`)}
                            >
                              Ver relatório →
                            </button>
                          </div>
                        </Popup>
                      </CircleMarker>
                    ))}
                  </MapContainer>

                  {/* Legenda de risco — overlay */}
                  <div className="absolute bottom-4 left-4 z-[1000] bg-white/90 backdrop-blur-sm rounded-xl px-3 py-2.5 shadow-md border border-slate-200/60">
                    <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Risco</p>
                    {[
                      { label: 'Baixo',    color: '#22c55e' },
                      { label: 'Moderado', color: '#60a5fa' },
                      { label: 'Alto',     color: '#f97316' },
                      { label: 'Crítico',  color: '#ef4444' },
                    ].map(({ label, color }) => (
                      <div key={label} className="flex items-center gap-2 text-[10px] text-slate-600 py-0.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Painéis laterais */}
          <div className="col-span-12 xl:col-span-5 grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Ranking de bairros */}
            <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm">
              <CardHeader className="pb-0 px-5 pt-5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold text-slate-800">Ranking de bairros</CardTitle>
                  <span className="text-xs text-slate-400 cursor-default">focos ativos</span>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-3">
                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                  </div>
                ) : !data?.rankingBairro.length ? (
                  <p className="text-sm text-slate-400 py-6 text-center">Sem dados por bairro.</p>
                ) : (
                  <div>
                    {data.rankingBairro.slice(0, 5).map((r, idx) => (
                      <div
                        key={r.bairro}
                        className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-none transition-all duration-150 hover:bg-slate-50 hover:translate-x-0.5 rounded px-1"
                      >
                        <span
                          className={cn(
                            'w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center shrink-0',
                            RANK_BADGE_CLS[idx] ?? 'bg-slate-100 text-slate-500',
                          )}
                        >
                          {idx + 1}
                        </span>
                        <span className="text-sm text-slate-700 font-medium flex-1 truncate">{r.bairro}</span>
                        <span
                          className={cn(
                            'text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums',
                            r.focosAtivos > 10
                              ? 'bg-red-100 text-red-700'
                              : r.focosAtivos > 5
                              ? 'bg-orange-100 text-orange-700'
                              : r.focosAtivos > 0
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-500',
                          )}
                        >
                          {r.focosAtivos}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <SectionCard title="PNCD executado">
              <DepositosDonut depositos={data?.depositosPncd} loading={isLoading} />
            </SectionCard>

            {/* PNCD compacto por tipo */}
            <SectionCard title="Depósitos PNCD por tipo">
                {isLoading ? (
                  <Skeleton className="h-40 w-full rounded-xl" />
                ) : !pncdChartData.length ? (
                  <p className="text-sm text-slate-400 py-6 text-center">Sem dados de depósitos.</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={150}>
                      <BarChart
                        data={pncdChartData}
                        barGap={3}
                        barSize={10}
                        margin={{ top: 4, right: 4, left: -22, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.12} />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
                        <ChartTooltip
                          cursor={{ fill: '#f1f5f9', opacity: 0.8 }}
                          content={(props) => (
                            <PncdTooltip
                              active={props.active}
                              payload={props.payload as Array<{ name?: string; value?: number; color?: string }>}
                              label={props.label as string}
                              rows={pncdChartData}
                            />
                          )}
                        />
                        <Bar dataKey="Insp" name="Inspecionados" fill={PNCD_BARRA_INSPECIONADOS} radius={[6, 6, 0, 0]} />
                        <Bar dataKey="Foco" name="Com foco"      fill={PNCD_BARRA_COM_FOCO} radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="flex gap-4 justify-center mt-2">
                      {[
                        { color: PNCD_BARRA_INSPECIONADOS, label: 'Inspecionados' },
                        { color: PNCD_BARRA_COM_FOCO, label: 'Com foco' },
                      ].map(({ color, label }) => (
                        <span key={label} className="flex items-center gap-1.5 text-[10px] text-slate-400">
                          <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
                          {label}
                        </span>
                      ))}
                    </div>
                    {data && (
                      <p className="text-[10px] text-slate-400 text-center mt-1">
                        {data.depositosPncd.totais.inspecionados} inspecionados · {data.depositosPncd.totais.comFoco} com foco
                      </p>
                    )}
                  </>
                )}
            </SectionCard>

            {/* Fatores de risco */}
            <SectionCard title="Fatores de risco predominantes">
              {isLoading ? (
                <Skeleton className="h-24 w-full rounded-xl" />
              ) : !fatoresAtivos.length ? (
                <p className="text-sm text-slate-400 py-4 text-center">Sem fatores registrados.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {fatoresAtivos.map(([key, count]) => (
                    <span
                      key={key}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-orange-50 border border-orange-200 text-orange-800"
                    >
                      <span className="font-bold tabular-nums">{count}</span>
                      <span className="text-orange-600">{FATOR_LABEL[key]}</span>
                    </span>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </div>

        {/* ── D) Grid inferior: tabela (8) + fatores+vuln (4) ── */}
        <div className="grid grid-cols-12 gap-6">

          {/* Resumo por bairro — tabela larga */}
          <Card className="col-span-12 lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <CardHeader className="pb-0 px-5 pt-5">
              <CardTitle className="text-sm font-semibold text-slate-800">Resumo por bairro</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 pt-3">
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                </div>
              ) : !data?.rankingBairro.length ? (
                <p className="text-sm text-slate-400 py-6 text-center">Sem dados por bairro para o período.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left text-xs font-semibold text-slate-400 pb-2 pr-4">Bairro</th>
                        <th className="text-right text-xs font-semibold text-slate-400 pb-2 px-3">Total focos</th>
                        <th className="text-right text-xs font-semibold text-slate-400 pb-2 px-3">Ativos</th>
                        <th className="text-right text-xs font-semibold text-slate-400 pb-2 px-3">Vistorias</th>
                        <th className="text-right text-xs font-semibold text-slate-400 pb-2 pl-3">SLA vencidos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rankingBairro.map((r, idx) => (
                        <tr
                          key={r.bairro}
                          className="border-b border-slate-50 last:border-none hover:bg-slate-50 transition-colors"
                        >
                          <td className="py-2.5 pr-4">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  'w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center shrink-0',
                                  RANK_BADGE_CLS[idx] ?? 'bg-slate-100 text-slate-500',
                                )}
                              >
                                {idx + 1}
                              </span>
                              <span className="text-slate-700 font-medium truncate max-w-[160px]">{r.bairro}</span>
                            </div>
                          </td>
                          <td className="text-right py-2.5 px-3 text-slate-600 tabular-nums">{r.totalFocos}</td>
                          <td className="text-right py-2.5 px-3 tabular-nums">
                            <span className={cn(
                              'font-semibold',
                              r.focosAtivos > 0 ? 'text-red-500' : 'text-slate-300',
                            )}>
                              {r.focosAtivos}
                            </span>
                          </td>
                          <td className="text-right py-2.5 px-3 text-slate-600 tabular-nums">{r.vistoriasRealizadas}</td>
                          <td className="text-right py-2.5 pl-3 tabular-nums">
                            {r.slaVencidos > 0 ? (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                                {r.slaVencidos}
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Coluna inferior direita: vulnerabilidade + resolução */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-5">

            <SectionCard title="Taxa de resolução">
              <ResolutionGauge value={data?.kpis.taxaResolucaoPct} loading={isLoading} />
            </SectionCard>

            {/* Grupos vulneráveis */}
            <Card className="bg-white rounded-2xl border border-slate-200 shadow-sm flex-1">
              <CardHeader className="pb-0 px-5 pt-5">
                <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-400" />
                  Grupos vulneráveis
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-3">
                {isLoading ? (
                  <div className="grid grid-cols-2 gap-3">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {VULN_KEYS.map((k) => {
                      const meta = VULN_META[k];
                      const value = data?.fatoresRisco?.[k] ?? 0;
                      return (
                        <div
                          key={k}
                          className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-1"
                        >
                          <div className="flex items-center gap-1.5">
                            <meta.icon className={cn('h-3.5 w-3.5', meta.iconCls)} />
                          </div>
                          <p className={cn(
                            'text-xl font-bold tabular-nums leading-none',
                            value > 0 ? 'text-slate-800' : 'text-slate-300',
                          )}>
                            {value}
                          </p>
                          <p className="text-[10px] text-slate-400 leading-tight">{meta.label}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Metadados — discreto */}
            {data?.meta && (
              <div className="text-[10px] text-slate-400 space-y-0.5 px-1">
                <p>Máx. 500 pontos no mapa · {data.meta.pesoMapaRegra}</p>
                {data.meta.observacoes.map((obs, i) => <p key={i}>{obs}</p>)}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
