import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Copy,
  Users,
  UsersRound,
  HeartPulse,
  AlertTriangle,
  Droplets,
  Waves,
  Check,
  MoreVertical,
  Plane,
  User,
  CloudRain,
  Pencil,
  FlaskConical,
  Image,
  Info,
  ShieldAlert,
  ClipboardCheck,
  Clock,
  Building2,
  Camera,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { useFocosRisco } from '@/hooks/queries/useFocosRisco';
import { useFocoDetalhes } from '@/hooks/queries/useFocoDetalhes';
import { useResumoVisualVistoria } from '@/hooks/queries/useResumoVisualVistoria';
import { PrioridadeBadge } from '@/components/foco/PrioridadeBadge';
import { COR_STATUS, LABEL_STATUS, LABEL_ORIGEM } from '@/types/focoRisco';
import { LABEL_CLASSIFICACAO_INICIAL } from '@/types/database';
import type { FocoRiscoClassificacao, FocoRiscoStatus } from '@/types/database';
import type { ResumoVisualVistoriaResponse } from '@/types/resumoVistoria';

// ── Aliases de tipo ───────────────────────────────────────────────────────────

type Resumo = ResumoVisualVistoriaResponse;
type Consolidacao = NonNullable<Resumo['consolidacao']>;
type Moradores = NonNullable<Resumo['moradores']>;
type Grupos = NonNullable<Resumo['gruposVulneraveis']>;
type Sintomas = NonNullable<Resumo['sintomas']>;
type FatoresRisco = NonNullable<Resumo['fatoresRisco']>;
type Deposito = Resumo['depositosPncd']['itens'][0];
type CalhaItem = Resumo['calhas']['itens'][0];
type Tratamento = Resumo['tratamento'];
type Evidencia = Resumo['evidencias'][0];
type HistoricoItem = Resumo['historico'][0];

// ── Stepper ───────────────────────────────────────────────────────────────────

const RELATORIO_STEPS: { id: string; label: string }[] = [
  { id: 'suspeita', label: 'Suspeita' },
  { id: 'em_triagem', label: 'Em triagem' },
  { id: 'aguarda_inspecao', label: 'Aguarda inspeção' },
  { id: 'em_rota', label: 'Em rota' },
  { id: 'em_inspecao', label: 'Em inspeção' },
  { id: 'confirmado', label: 'Confirmado' },
  { id: 'em_tratamento', label: 'Em tratamento' },
  { id: 'resolvido', label: 'Resolvido' },
];

function statusToStepIndex(status: string): number {
  if (status === 'descartado') return 5;
  const map: Record<FocoRiscoStatus, number> = {
    suspeita: 0, em_triagem: 1, aguarda_inspecao: 2,
    em_inspecao: 4, confirmado: 5, em_tratamento: 6,
    resolvido: 7, descartado: 5,
  };
  return map[status as FocoRiscoStatus] ?? 0;
}

function RelatorioStatusStepper({ currentStatus }: { currentStatus: string }) {
  const effectiveIdx = statusToStepIndex(currentStatus);
  const isDescartado = currentStatus === 'descartado';
  const isResolvido = currentStatus === 'resolvido';

  return (
    <div className="w-full overflow-x-auto pb-1 -mx-1">
      <div className="flex items-start min-w-max px-2 pt-2 pb-1">
        {RELATORIO_STEPS.map((step, idx) => {
          const last = idx === RELATORIO_STEPS.length - 1;
          const done = idx < effectiveIdx || (isResolvido && last);
          const current = idx === effectiveIdx && !(isResolvido && last);
          const pending = !done && !current;
          return (
            <div key={step.id} className="flex items-start">
              <div className="flex flex-col items-center w-[76px] sm:w-[88px] shrink-0">
                <div className={cn(
                  'w-8 h-8 rounded-sm border-2 flex items-center justify-center text-xs font-bold transition-colors',
                  done && 'bg-green-500 border-green-500 text-white',
                  current && !done && 'bg-green-600 border-green-600 text-white shadow-sm',
                  pending && 'bg-muted/80 border-muted-foreground/25 text-muted-foreground',
                )}>
                  {done ? <Check className="w-4 h-4 stroke-[3]" /> : idx + 1}
                </div>
                <span className={cn(
                  'mt-1.5 text-[10px] sm:text-[11px] font-medium text-center leading-tight px-0.5',
                  (done || current) && 'text-green-700 dark:text-green-400',
                  pending && 'text-muted-foreground',
                )}>
                  {step.label}
                </span>
                <span className="text-[9px] text-muted-foreground mt-0.5 min-h-[12px]">
                  {done ? 'Concluído' : current ? 'Atual' : ''}
                </span>
                {isDescartado && step.id === 'confirmado' && current && (
                  <span className="text-[9px] text-destructive font-semibold mt-0.5">Descartado</span>
                )}
              </div>
              {idx < RELATORIO_STEPS.length - 1 && (
                <div className={cn(
                  'h-0.5 w-5 sm:w-8 mt-4 shrink-0 self-start rounded-sm',
                  idx < effectiveIdx || (isResolvido && idx === RELATORIO_STEPS.length - 2)
                    ? 'bg-green-500'
                    : 'bg-[repeating-linear-gradient(90deg,hsl(var(--border))_0px,hsl(var(--border))_4px,transparent_4px,transparent_8px)]',
                )} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Origem icon ───────────────────────────────────────────────────────────────

function origemIcon(tipo: string) {
  switch (tipo) {
    case 'drone': return <Plane className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden />;
    case 'agente': return <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden />;
    case 'pluvio': return <CloudRain className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden />;
    case 'manual': return <Pencil className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden />;
    default: return <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden />;
  }
}

// ── ISTI Gauge ────────────────────────────────────────────────────────────────

function IstiGauge({ score }: { score: number }) {
  const gradId = `isti-grad-${useId().replace(/:/g, '')}`;
  const clamped = Math.max(0, Math.min(100, score));
  const r = 42;
  const arcLen = Math.PI * r;
  const filled = (clamped / 100) * arcLen;

  return (
    <div className="relative mx-auto h-[132px] w-full max-w-[220px]">
      <svg viewBox="0 0 100 58" className="absolute bottom-0 left-0 w-full max-h-[72px]" aria-hidden>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#dc2626" />
            <stop offset="50%" stopColor="#ea580c" />
            <stop offset="100%" stopColor="#fb923c" />
          </linearGradient>
        </defs>
        <path d="M 8 52 A 42 42 0 0 1 92 52" fill="none" stroke="#e4e4e7" className="dark:stroke-zinc-600" strokeWidth="9" strokeLinecap="round" />
        {filled > 0.5 && (
          <path d="M 8 52 A 42 42 0 0 1 92 52" fill="none" stroke={`url(#${gradId})`} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${filled} ${arcLen}`} />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pb-5 pointer-events-none">
        <span className="text-[2rem] font-bold tabular-nums leading-none tracking-tight text-foreground sm:text-[2.25rem]">
          {Math.round(clamped)}
        </span>
        <span className="mt-1 text-xs font-medium text-muted-foreground">de 100</span>
      </div>
    </div>
  );
}

function istiClassificacao(score: number): { label: string; badgeClass: string } {
  if (score >= 80) return { label: 'Muito alto', badgeClass: 'bg-red-600 text-white shadow-sm' };
  if (score >= 60) return { label: 'Alto', badgeClass: 'bg-red-600 text-white shadow-sm' };
  if (score >= 40) return { label: 'Médio', badgeClass: 'bg-amber-500 text-white shadow-sm' };
  if (score >= 20) return { label: 'Baixo', badgeClass: 'bg-sky-600 text-white shadow-sm' };
  return { label: 'Muito baixo', badgeClass: 'bg-emerald-600 text-white shadow-sm' };
}

// ── Mapa ──────────────────────────────────────────────────────────────────────

function MapaSimples({ lat, lng, className }: { lat: number; lng: number; className?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const center: [number, number] = [lat, lng];
  if (!mounted) {
    return (
      <div className={cn('relative flex min-h-[200px] items-center justify-center overflow-hidden rounded-sm border border-border/60 bg-muted', className)}>
        <span className="text-xs text-muted-foreground">Carregando mapa…</span>
      </div>
    );
  }
  return (
    <div className={cn('relative isolate z-0 min-h-[200px] overflow-hidden rounded-sm border border-border/60 bg-muted [&_.leaflet-container]:font-sans', className)}>
      <MapContainer key={`${lat},${lng}`} center={center} zoom={16} className="z-0 h-full w-full min-h-[200px]" style={{ height: '100%', width: '100%', minHeight: 200 }} scrollWheelZoom zoomControl>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
        <CircleMarker center={center} radius={11} pathOptions={{ color: '#b91c1c', fillColor: '#ef4444', fillOpacity: 0.9, weight: 2 }}>
          <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
            <span className="font-mono text-[11px]">{lat.toFixed(5)}, {lng.toFixed(5)}</span>
          </Tooltip>
        </CircleMarker>
      </MapContainer>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDatetime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-xs font-medium">{value}</p>
    </div>
  );
}

function TabCountBadge({ count }: { count: number }) {
  if (count < 1) return null;
  return (
    <span className="ml-1 inline-flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-sm bg-muted px-1 text-[10px] font-semibold tabular-nums text-muted-foreground">
      {count > 99 ? '99+' : count}
    </span>
  );
}

// ── Resumo estratégico tile ───────────────────────────────────────────────────

type TileVariant = 'green' | 'blue' | 'orange' | 'red';

const TILE_STYLES: Record<TileVariant, string> = {
  green: 'border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/35 dark:text-emerald-200',
  blue: 'border-sky-200/80 bg-sky-50 text-sky-700 dark:border-sky-800/50 dark:bg-sky-950/35 dark:text-sky-200',
  orange: 'border-orange-200/80 bg-orange-50 text-orange-700 dark:border-orange-800/50 dark:bg-orange-950/35 dark:text-orange-200',
  red: 'border-red-200/80 bg-red-50 text-red-700 dark:border-red-800/50 dark:bg-red-950/35 dark:text-red-200',
};

function EstrategicoTile({ value, label, variant }: { value: string | number; label: string; variant: TileVariant }) {
  return (
    <div className={cn('flex min-w-0 flex-1 flex-col items-center justify-center rounded-sm border px-1.5 py-3 text-center', TILE_STYLES[variant])}>
      <p className="text-xl font-bold tabular-nums leading-none tracking-tight sm:text-2xl">{value}</p>
      <p className="mt-2 max-w-[7.5rem] text-[10px] font-medium leading-tight text-foreground/80 dark:text-foreground/75">{label}</p>
    </div>
  );
}

// ── Moradores card ────────────────────────────────────────────────────────────

function MoradoresCard({ moradores }: { moradores: Moradores | null }) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-600 stroke-[1.75]" />
          <CardTitle className="text-sm font-semibold text-blue-600">Moradores</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">
        {!moradores ? (
          <p className="text-xs text-muted-foreground">Sem registro de moradores.</p>
        ) : (
          <>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-3xl font-bold text-foreground tabular-nums leading-none">
                {moradores.total != null ? moradores.total : '—'}
              </span>
              <span className="text-sm text-muted-foreground font-medium">Total</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Crianças', value: moradores.criancas7Anos, activeColor: 'text-sky-600', activeBg: 'bg-sky-50 border-sky-200 dark:bg-sky-950/30 dark:border-sky-800' },
                { label: 'Idosos', value: moradores.idosos, activeColor: 'text-amber-600', activeBg: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800' },
                { label: 'Gestantes', value: moradores.gestantes, activeColor: 'text-rose-600', activeBg: 'bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800' },
              ].map((item) => (
                <div key={item.label} className={cn('rounded-sm border px-2 py-2.5 text-center transition-colors', item.value > 0 ? item.activeBg : 'border-border/80 bg-background')}>
                  <p className={cn('text-lg font-bold tabular-nums leading-tight', item.value > 0 ? item.activeColor : 'text-muted-foreground')}>
                    {item.value > 0 ? item.value : '—'}
                  </p>
                  <p className="text-[11px] text-muted-foreground font-medium mt-1">{item.label}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Grupos Vulneráveis card ───────────────────────────────────────────────────

function Tag({ label, active, tone = 'success' }: { label: string; active: boolean; tone?: 'success' | 'warning' | 'danger' }) {
  const chip = 'rounded-sm';
  if (!active) {
    return (
      <span className={cn('inline-flex items-center border border-border/90 bg-background px-2.5 py-1 text-[11px] font-semibold text-muted-foreground', chip)}>
        {label}
      </span>
    );
  }
  if (tone === 'danger') {
    return (
      <span className={cn('inline-flex items-center gap-1.5 border border-red-200/90 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-800 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-200', chip)}>
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" aria-hidden />
        {label}
      </span>
    );
  }
  if (tone === 'warning') {
    return (
      <span className={cn('inline-flex items-center gap-1.5 border border-orange-200/90 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-800 dark:border-orange-800/50 dark:bg-orange-950/40 dark:text-orange-200', chip)}>
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" aria-hidden />
        {label}
      </span>
    );
  }
  return (
    <span className={cn('inline-flex items-center gap-1.5 border border-emerald-200/90 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-100', chip)}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
      {label}
    </span>
  );
}

function GruposVulneraveisCard({ grupos }: { grupos: Grupos | null }) {
  if (!grupos) {
    return (
      <Card className="border-border/60">
        <CardHeader className="pb-3 pt-4 px-4">
          <div className="flex items-center gap-2">
            <UsersRound className="h-4 w-4 text-blue-600 stroke-[1.75]" aria-hidden />
            <CardTitle className="text-sm font-semibold text-blue-600">Grupos vulneráveis</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <p className="text-xs text-muted-foreground">Sem registro.</p>
        </CardContent>
      </Card>
    );
  }

  const tags = [
    { label: 'Idosos', active: grupos.idosos, tone: 'warning' as const },
    { label: 'Crianças ≤7 anos', active: grupos.criancas7Anos, tone: 'warning' as const },
    { label: 'Gestantes', active: grupos.gestantes, tone: 'warning' as const },
    { label: 'Mobilidade reduzida', active: grupos.mobilidadeReduzida, tone: 'danger' as const },
    { label: 'Acamado', active: grupos.acamado, tone: 'danger' as const },
    { label: 'Menor incapaz', active: grupos.menorIncapaz, tone: 'danger' as const },
    { label: 'Idoso incapaz', active: grupos.idosoIncapaz, tone: 'danger' as const },
  ];

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center gap-2">
          <UsersRound className="h-4 w-4 text-blue-600 stroke-[1.75]" aria-hidden />
          <CardTitle className="text-sm font-semibold text-blue-600">Grupos vulneráveis</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="flex flex-wrap gap-2">
          {tags.filter((t) => t.active).map((t) => (
            <Tag key={t.label} label={t.label} active tone={t.tone} />
          ))}
          {tags.every((t) => !t.active) && (
            <p className="text-xs text-muted-foreground">Nenhum grupo vulnerável identificado.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Sintomas card ─────────────────────────────────────────────────────────────

function SintomasCard({ sintomas }: { sintomas: Sintomas | null }) {
  const items: Array<{ key: keyof Pick<Sintomas, 'febre' | 'manchasVermelhas' | 'dorArticulacoes' | 'dorCabeca' | 'nausea'>; label: string; tone?: 'warning' }> = [
    { key: 'febre', label: 'Febre' },
    { key: 'manchasVermelhas', label: 'Manchas vermelhas', tone: 'warning' },
    { key: 'dorArticulacoes', label: 'Dor articulações' },
    { key: 'dorCabeca', label: 'Dor de cabeça' },
    { key: 'nausea', label: 'Náusea' },
  ];

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center gap-2">
          <HeartPulse className="h-4 w-4 text-blue-600 stroke-[1.75]" aria-hidden />
          <CardTitle className="text-sm font-semibold text-blue-600">Sintomas informados</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {!sintomas ? (
          <p className="text-xs text-muted-foreground">Sem registro de sintomas.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {items.filter((i) => sintomas[i.key]).map((i) => (
                <Tag key={i.label} label={i.label} active tone={i.tone ?? 'success'} />
              ))}
              {items.every((i) => !sintomas[i.key]) && (
                <p className="text-xs text-muted-foreground">Nenhum sintoma relatado.</p>
              )}
            </div>
            {sintomas.moradoresSintomasQtd > 0 && (
              <p className="mt-2 text-[10px] text-muted-foreground">{sintomas.moradoresSintomasQtd} morador(es) com sintomas</p>
            )}
            {sintomas.gerouCasoNotificadoId && (
              <p className="mt-1 text-[10px] text-amber-600 font-medium">Caso notificado gerado</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Depósitos card ────────────────────────────────────────────────────────────

const DEPOSITO_TIPOS = ['A1', 'A2', 'B', 'C', 'D1', 'D2', 'E'] as const;

function DepositosCard({ depositosPncd }: { depositosPncd: Resumo['depositosPncd'] }) {
  const { itens, totais } = depositosPncd;
  const byTipo = Object.fromEntries(DEPOSITO_TIPOS.map((t) => [t, itens.find((d) => d.tipo === t) ?? null]));
  const max = Math.max(1, ...itens.map((d) => d.qtdInspecionados));

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center gap-2">
          <Droplets className="h-4 w-4 text-blue-600 stroke-[1.75]" aria-hidden />
          <CardTitle className="text-sm font-semibold text-blue-600">Depósitos PNCD</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {itens.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem depósitos registrados.</p>
        ) : (
          <>
            <div className="flex items-stretch gap-1.5 sm:gap-2">
              {DEPOSITO_TIPOS.map((tipo) => {
                const dep = byTipo[tipo];
                const total = dep?.qtdInspecionados ?? 0;
                const comFoco = dep?.qtdComFocos ?? 0;
                const pct = total > 0 ? (total / max) * 100 : 0;
                const hasFoco = comFoco > 0;
                const fillPct = total > 0 ? Math.max(8, pct) : 0;
                return (
                  <div key={tipo} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                    <span className={cn('text-[10px] font-semibold tabular-nums', hasFoco ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground')}>
                      {tipo}
                    </span>
                    <div className="flex h-16 w-full flex-col justify-end rounded-[2px] border border-border/70 bg-muted/50 p-px dark:bg-muted/30">
                      {total > 0 ? (
                        <div className={cn('w-full rounded-[1px] transition-colors', hasFoco ? 'bg-orange-400 dark:bg-orange-500' : 'bg-emerald-500 dark:bg-emerald-600')} style={{ height: `${fillPct}%` }} />
                      ) : (
                        <div className="mx-auto h-1 w-3/4 rounded-[1px] bg-muted-foreground/15" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 pt-2 border-t border-border/50 grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'Com foco', value: totais.comFocos, color: totais.comFocos > 0 ? 'text-orange-600' : 'text-muted-foreground' },
                { label: 'Com água', value: totais.comAgua, color: totais.comAgua > 0 ? 'text-blue-600' : 'text-muted-foreground' },
                { label: 'Eliminados', value: totais.eliminados, color: 'text-muted-foreground' },
              ].map((t) => (
                <div key={t.label}>
                  <p className={cn('text-base font-bold tabular-nums', t.color)}>{t.value}</p>
                  <p className="text-[10px] text-muted-foreground">{t.label}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Calhas card ───────────────────────────────────────────────────────────────

const CALHA_LABEL: Record<string, string> = {
  limpa: 'Limpa', entupida: 'Obstruída', com_folhas: 'Com folhas',
  danificada: 'Danificada', com_agua_parada: 'Com água parada',
};
const CALHA_COLOR: Record<string, string> = {
  limpa: 'text-green-600', entupida: 'text-orange-500',
  com_folhas: 'text-yellow-600', danificada: 'text-red-500', com_agua_parada: 'text-red-500',
};

function CalhasCard({ calhas }: { calhas: Resumo['calhas'] }) {
  const { itens, resumo } = calhas;
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center gap-2">
          <Waves className="h-4 w-4 text-blue-600 stroke-[1.75]" aria-hidden />
          <CardTitle className="text-sm font-semibold text-blue-600">Calhas</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {itens.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem calhas registradas.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {resumo.possuiCalhaComFoco && <Badge variant="outline" className="rounded-sm text-[10px] border-orange-200 text-orange-800 bg-orange-50/80">Com foco ativo</Badge>}
              {resumo.possuiAguaParada && <Badge variant="outline" className="rounded-sm text-[10px] border-red-200 text-red-800 bg-red-50/80">Água parada</Badge>}
              {resumo.possuiCalhaTratada && <Badge variant="outline" className="rounded-sm text-[10px] border-emerald-200 text-emerald-800 bg-emerald-50/80">Tratamento realizado</Badge>}
            </div>
            {resumo.condicoesCriticas.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Condições críticas</p>
                <div className="flex flex-wrap gap-1">
                  {Array.from(new Set(resumo.condicoesCriticas)).map((c) => (
                    <span key={c} className={cn('text-xs font-semibold', CALHA_COLOR[c] ?? 'text-foreground')}>
                      {CALHA_LABEL[c] ?? c}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground pt-1">{itens.length} calha(s) registrada(s)</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Tratamento card ───────────────────────────────────────────────────────────

function TratamentoCard({ tratamento }: { tratamento: Tratamento }) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-blue-600 stroke-[1.75]" aria-hidden />
          <CardTitle className="text-sm font-semibold text-blue-600">Tratamento</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Larvicida', value: tratamento.larvicidaAplicado ? 'Sim' : 'Não', highlight: tratamento.larvicidaAplicado },
            { label: 'Total g', value: tratamento.totalLarvicidaG > 0 ? `${tratamento.totalLarvicidaG}g` : '—', highlight: false },
            { label: 'Dep. eliminados', value: tratamento.depositosEliminados.toString(), highlight: tratamento.depositosEliminados > 0 },
            { label: 'Dep. vedados', value: tratamento.depositosVedados.toString(), highlight: tratamento.depositosVedados > 0 },
            { label: 'Calhas tratadas', value: tratamento.calhasTratadas.toString(), highlight: tratamento.calhasTratadas > 0 },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-[10px] text-muted-foreground">{item.label}</p>
              <p className={cn('text-sm font-bold', item.highlight ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground')}>{item.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Fatores de risco card ─────────────────────────────────────────────────────

const FATORES_LABELS: Array<{ key: keyof Omit<FatoresRisco, 'outroRiscoVetorial'>; label: string }> = [
  { key: 'lixo', label: 'Lixo acumulado' },
  { key: 'caixaDestampada', label: 'Caixa destampada' },
  { key: 'criadouroAnimais', label: 'Criadouro animais' },
  { key: 'residuosOrganicos', label: 'Resíduos orgânicos' },
  { key: 'residuosQuimicos', label: 'Resíduos químicos' },
  { key: 'residuosMedicos', label: 'Resíduos médicos' },
  { key: 'acumuloMaterialOrganico', label: 'Acúmulo orgânico' },
  { key: 'animaisSinaisLv', label: 'Animais c/ sinais LV' },
  { key: 'riscoAlimentar', label: 'Risco alimentar' },
  { key: 'riscoMoradia', label: 'Risco moradia' },
  { key: 'depQuimico', label: 'Dep. químico' },
  { key: 'menorIncapaz', label: 'Menor incapaz' },
  { key: 'idosoIncapaz', label: 'Idoso incapaz' },
  { key: 'mobilidadeReduzida', label: 'Mobilidade reduzida' },
  { key: 'acamado', label: 'Acamado' },
];

function FatoresRiscoCard({ fatoresRisco }: { fatoresRisco: FatoresRisco | null }) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-blue-600 stroke-[1.75]" aria-hidden />
          <CardTitle className="text-sm font-semibold text-blue-600">Fatores de risco</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {!fatoresRisco ? (
          <p className="text-xs text-muted-foreground">Sem registro de riscos.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {FATORES_LABELS.filter((f) => fatoresRisco[f.key]).map((f) => (
                <Tag key={f.key} label={f.label} active tone="warning" />
              ))}
              {FATORES_LABELS.every((f) => !fatoresRisco[f.key]) && !fatoresRisco.outroRiscoVetorial && (
                <p className="text-xs text-muted-foreground">Nenhum fator de risco ativo.</p>
              )}
            </div>
            {fatoresRisco.outroRiscoVetorial && (
              <div className="mt-2 pt-2 border-t border-border/50">
                <p className="text-[10px] text-muted-foreground">Outro risco vetorial</p>
                <p className="text-[11px] font-semibold text-foreground">{fatoresRisco.outroRiscoVetorial}</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Consolidação card ─────────────────────────────────────────────────────────

function ConsolidacaoCard({ consolidacao }: { consolidacao: Consolidacao | null }) {
  if (!consolidacao) return null;

  const dimLabel: Record<string, string> = {
    vetorial: 'Vetorial', socioambiental: 'Socioambiental', saude: 'Saúde',
    vulnerabilidade: 'Vulnerabilidade domiciliar',
  };

  const campos = [
    { label: 'Resultado operacional', val: consolidacao.resultadoOperacional },
    { label: 'Prioridade final', val: consolidacao.prioridadeFinal },
    { label: 'Dimensão dominante', val: consolidacao.dimensaoDominante ? (dimLabel[consolidacao.dimensaoDominante] ?? consolidacao.dimensaoDominante) : null },
    { label: 'Risco vetorial', val: consolidacao.riscoVetorial },
    { label: 'Risco socioambiental', val: consolidacao.riscoSocioambiental },
    { label: 'Vulnerabilidade domiciliar', val: consolidacao.vulnerabilidadeDomiciliar },
    { label: 'Alerta saúde', val: consolidacao.alertaSaude !== 'sem_alerta' ? consolidacao.alertaSaude : null },
    { label: 'Consolidado em', val: formatDatetime(consolidacao.consolidadoEm) },
  ].filter((c) => c.val);

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-indigo-600 stroke-[1.75]" aria-hidden />
            <CardTitle className="text-sm font-semibold text-indigo-600">Consolidação da vistoria</CardTitle>
          </div>
          {consolidacao.consolidacaoIncompleta && (
            <Badge variant="outline" className="rounded-sm text-[10px] border-amber-200 text-amber-700 bg-amber-50/80">Incompleta</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {consolidacao.consolidacaoResumo && (
          <p className="text-sm text-foreground leading-relaxed border-l-2 border-indigo-300 pl-3">
            {consolidacao.consolidacaoResumo}
          </p>
        )}
        {consolidacao.prioridadeMotivo && (
          <div>
            <p className="text-[10px] text-muted-foreground">Motivo da prioridade</p>
            <p className="text-xs font-medium text-foreground">{consolidacao.prioridadeMotivo}</p>
          </div>
        )}
        {campos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 border-t border-border/50">
            {campos.map((c) => (
              <div key={c.label}>
                <p className="text-[10px] text-muted-foreground">{c.label}</p>
                <p className="text-xs font-semibold capitalize">{c.val}</p>
              </div>
            ))}
          </div>
        )}
        {(consolidacao.versaoRegraConsolidacao || consolidacao.versaoPesosConsolidacao) && (
          <p className="text-[9px] text-muted-foreground/60 pt-1">
            Regra {consolidacao.versaoRegraConsolidacao ?? '—'} · Pesos {consolidacao.versaoPesosConsolidacao ?? '—'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Explicabilidade card ──────────────────────────────────────────────────────

function ExplicabilidadeCard({ explicabilidade }: { explicabilidade: Resumo['explicabilidade'] }) {
  const { motivos, alertas, pendencias } = explicabilidade;
  if (!motivos.length && !alertas.length && !pendencias.length) return null;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-600 stroke-[1.75]" aria-hidden />
          <CardTitle className="text-sm font-semibold text-amber-600">Explicabilidade</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {motivos.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Motivos</p>
            <ul className="space-y-1">
              {motivos.map((m, i) => (
                <li key={i} className="text-xs text-foreground leading-relaxed">{m}</li>
              ))}
            </ul>
          </div>
        )}
        {alertas.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Alertas</p>
            <ul className="space-y-1">
              {alertas.map((a, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-sm bg-amber-500" aria-hidden />
                  {a}
                </li>
              ))}
            </ul>
          </div>
        )}
        {pendencias.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Pendências</p>
            <ul className="space-y-1">
              {pendencias.map((p, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-red-700 dark:text-red-400">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-sm bg-red-500" aria-hidden />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Evidências tab ────────────────────────────────────────────────────────────

type FiltroEv = 'todos' | 'deposito' | 'fachada' | 'calha' | 'operacao';

const DEPOSITO_TIPO_LABEL: Record<string, string> = {
  A1: 'Caixa d\'água (solo)', A2: 'Reservatório elevado',
  B: 'Depósito móvel', C: 'Depósito fixo (piscina)',
  D1: 'Pneus', D2: 'Lixo / entulho', E: 'Natural',
};

function FotoCard({ ev }: { ev: Evidencia }) {
  return (
    <a
      href={ev.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative overflow-hidden rounded-sm border border-border/60 block"
    >
      <img
        src={ev.url}
        alt={ev.legenda ?? 'Evidência'}
        className="h-28 w-full object-cover transition-opacity group-hover:opacity-90"
      />
      {(ev.legenda || ev.createdAt) && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2 py-1.5">
          {ev.legenda && <p className="line-clamp-2 text-[10px] font-medium leading-snug text-white">{ev.legenda}</p>}
          {ev.createdAt && <p className="mt-0.5 text-[9px] text-white/65">{formatDate(ev.createdAt)}</p>}
        </div>
      )}
    </a>
  );
}

function SecaoEvidencias({ titulo, count, children }: { titulo: string; count: number; children: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</p>
        <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">{count}</span>
      </div>
      {children}
    </section>
  );
}

function EvidenciasTab({ evidencias }: { evidencias: Evidencia[] }) {
  const [filtro, setFiltro] = useState<FiltroEv>('todos');

  const fachada   = evidencias.filter(e => e.origem === 'vistoria' && !e.depositoTipo);
  const depositos = evidencias.filter(e => !!e.depositoTipo);
  const calhas    = evidencias.filter(e => e.origem === 'calha');
  const operacoes = evidencias.filter(e => e.origem === 'operacao');

  const depositosPorTipo: Record<string, { antes?: Evidencia; depois?: Evidencia }> = {};
  for (const ev of depositos) {
    const t = ev.depositoTipo!;
    if (!depositosPorTipo[t]) depositosPorTipo[t] = {};
    if (ev.depositoMomento === 'antes')  depositosPorTipo[t].antes  = ev;
    else                                  depositosPorTipo[t].depois = ev;
  }
  const tiposComFotos = DEPOSITO_TIPOS.filter(t => depositosPorTipo[t]);

  const chips: Array<{ key: FiltroEv; label: string; count: number }> = [
    { key: 'todos',    label: 'Todos',          count: evidencias.length },
    { key: 'deposito', label: 'Depósitos PNCD', count: depositos.length },
    { key: 'fachada',  label: 'Fachada',         count: fachada.length },
    { key: 'calha',    label: 'Calhas',           count: calhas.length },
    { key: 'operacao', label: 'Operações',        count: operacoes.length },
  ].filter(c => c.key === 'todos' || c.count > 0);

  if (evidencias.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Image className="h-8 w-8 text-muted-foreground/40 mb-2" aria-hidden />
        <p className="text-sm text-muted-foreground">Não há evidências registradas.</p>
      </div>
    );
  }

  const show = (key: FiltroEv) => filtro === 'todos' || filtro === key;

  return (
    <div className="space-y-5">

      {/* Filter chips */}
      {chips.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map(c => (
            <button
              key={c.key}
              type="button"
              onClick={() => setFiltro(c.key)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-[11px] font-semibold transition-colors',
                filtro === c.key
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border/70 bg-background text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground',
              )}
            >
              {c.label}
              <span className={cn(
                'rounded-[3px] px-1 text-[10px] font-bold tabular-nums',
                filtro === c.key ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
              )}>
                {c.count}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Depósitos PNCD — comparação antes × depois */}
      {show('deposito') && tiposComFotos.length > 0 && (
        <SecaoEvidencias titulo="Depósitos PNCD" count={depositos.length}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {tiposComFotos.map(tipo => {
              const { antes, depois } = depositosPorTipo[tipo];
              return (
                <div key={tipo} className="overflow-hidden rounded-sm border border-border/70 bg-card">
                  <div className="flex items-center gap-2 border-b border-border/50 bg-muted/30 px-3 py-2">
                    <span className="text-xs font-bold text-foreground">{tipo}</span>
                    <span className="text-[10px] text-muted-foreground">{DEPOSITO_TIPO_LABEL[tipo] ?? tipo}</span>
                    <div className="ml-auto flex items-center gap-1">
                      {antes  && <span className="rounded-sm bg-sky-100 px-1.5 py-0.5 text-[9px] font-semibold text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">antes</span>}
                      {depois && <span className="rounded-sm bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">depois</span>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-border/50">
                    {(['antes', 'depois'] as const).map(momento => {
                      const ev = momento === 'antes' ? antes : depois;
                      return (
                        <div key={momento} className="relative">
                          {ev ? (
                            <a href={ev.url} target="_blank" rel="noopener noreferrer" className="group block">
                              <img
                                src={ev.url}
                                alt={`Depósito ${tipo} ${momento}`}
                                className="h-36 w-full object-cover transition-opacity group-hover:opacity-90"
                              />
                              {ev.createdAt && (
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                                  <p className="text-[9px] text-white/75">{formatDate(ev.createdAt)}</p>
                                </div>
                              )}
                            </a>
                          ) : (
                            <div className="flex h-36 flex-col items-center justify-center gap-1.5 bg-muted/40">
                              <Camera className="h-5 w-5 text-muted-foreground/30" aria-hidden />
                              <p className="text-[9px] text-muted-foreground/50">Sem foto {momento}</p>
                            </div>
                          )}
                          <div className="absolute left-1.5 top-1.5">
                            <span className={cn(
                              'rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white',
                              momento === 'antes' ? 'bg-sky-500/90' : 'bg-emerald-500/90',
                            )}>
                              {momento}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </SecaoEvidencias>
      )}

      {/* Fachada */}
      {show('fachada') && fachada.length > 0 && (
        <SecaoEvidencias titulo="Fachada" count={fachada.length}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {fachada.map((ev, i) => <FotoCard key={i} ev={ev} />)}
          </div>
        </SecaoEvidencias>
      )}

      {/* Calhas */}
      {show('calha') && calhas.length > 0 && (
        <SecaoEvidencias titulo="Calhas" count={calhas.length}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {calhas.map((ev, i) => <FotoCard key={i} ev={ev} />)}
          </div>
        </SecaoEvidencias>
      )}

      {/* Operações */}
      {show('operacao') && operacoes.length > 0 && (
        <SecaoEvidencias titulo="Operações de campo" count={operacoes.length}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {operacoes.map((ev, i) => <FotoCard key={i} ev={ev} />)}
          </div>
        </SecaoEvidencias>
      )}

    </div>
  );
}

// ── Histórico tab ─────────────────────────────────────────────────────────────

const HISTORICO_ORIGEM_COLOR: Record<string, string> = {
  foco: 'bg-blue-500',
  vistoria: 'bg-emerald-500',
  operacao: 'bg-orange-500',
};

const HISTORICO_TIPO_LABEL: Record<string, string> = {
  transicao_status: 'Transição de status',
  inicio_inspecao: 'Início da inspeção',
  vistoria_criada: 'Vistoria criada',
  vistoria_realizada: 'Visita realizada',
  vistoria_consolidada: 'Vistoria consolidada',
  operacao_criada: 'Operação iniciada',
  operacao_concluida: 'Operação concluída',
};

function HistoricoTab({ historico }: { historico: HistoricoItem[] }) {
  if (historico.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Clock className="h-8 w-8 text-muted-foreground/40 mb-2" aria-hidden />
        <p className="text-sm text-muted-foreground">Nenhum evento no histórico.</p>
      </div>
    );
  }

  return (
    <div className="relative pl-5">
      <div className="absolute left-1.5 top-0 bottom-0 w-px bg-border/60" aria-hidden />
      <div className="space-y-3">
        {historico.map((h, i) => (
          <div key={i} className="relative">
            <span className={cn('absolute -left-[1.125rem] top-1.5 h-2.5 w-2.5 rounded-sm border-2 border-background', HISTORICO_ORIGEM_COLOR[h.origem] ?? 'bg-muted-foreground')} aria-hidden />
            <div className="rounded-sm border border-border/60 bg-background px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[11px] font-semibold text-foreground">
                  {HISTORICO_TIPO_LABEL[h.tipo] ?? h.tipo}
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0">{formatDatetime(h.createdAt)}</span>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{h.descricao}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="max-w-7xl mx-auto p-4 space-y-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-20 w-full" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40" />)}
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40" />)}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GestorFocoRelatorio() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { clienteId } = useClienteAtivo();

  // Contexto de navegação do location.state (vindo de GestorFocos)
  const navFromState = location.state as { ids: string[]; index: number } | null;

  // Fallback: busca lista de focos quando não há contexto de navegação (URL direta / refresh)
  const { data: focosListaData } = useFocosRisco(
    !navFromState?.ids?.length ? clienteId : null,
    { pageSize: 500, orderBy: 'ultima_vistoria_em_desc' },
  );

  const navCtx = useMemo(() => {
    if (navFromState?.ids?.length) return navFromState;
    // sessionStorage (navegação prévia dentro da sessão)
    try {
      const raw = sessionStorage.getItem('gestor_focos_relatorio_nav');
      if (raw) {
        const { ids } = JSON.parse(raw) as { ids: string[] };
        if (Array.isArray(ids) && ids.length) {
          const idx = ids.indexOf(id ?? '');
          if (idx >= 0) return { ids, index: idx };
        }
      }
    } catch {}
    // API fallback
    if (focosListaData?.data?.length) {
      const ids = (focosListaData.data as { id: string }[]).map(f => f.id);
      const idx = ids.indexOf(id ?? '');
      if (idx >= 0) return { ids, index: idx };
    }
    return null;
  }, [navFromState, focosListaData, id]);

  const prevId = navCtx && navCtx.index > 0 ? navCtx.ids[navCtx.index - 1] : null;
  const nextId = navCtx && navCtx.index < navCtx.ids.length - 1 ? navCtx.ids[navCtx.index + 1] : null;
  const navegarParaFoco = (targetId: string, newIndex: number) => {
    if (!navCtx) return;
    try { sessionStorage.setItem('gestor_focos_relatorio_nav', JSON.stringify({ ids: navCtx.ids })); } catch {}
    navigate(`/gestor/focos/${targetId}/relatorio`, {
      state: { ids: navCtx.ids, index: newIndex },
    });
  };

  const { data, isLoading } = useFocoDetalhes(id);
  const { data: resumo, isLoading: resumoLoading } = useResumoVisualVistoria(id);

  if (isLoading) return <PageSkeleton />;
  if (!data) return null;

  const { foco, imovel, casosCount } = data;

  const statusKey = foco.status as FocoRiscoStatus;
  const statusHex = COR_STATUS[statusKey] ?? '#BA7517';
  const statusLabel = LABEL_STATUS[statusKey] ?? foco.status;
  const classificacao = foco.classificacaoInicial as FocoRiscoClassificacao | undefined;
  const focoLabel = classificacao ? (LABEL_CLASSIFICACAO_INICIAL[classificacao] ?? classificacao) : '—';
  const codigoStr = foco.codigoFoco ?? foco.id.slice(0, 8).toUpperCase();
  const mostrarEncaminhar = foco.status === 'em_triagem' || foco.status === 'aguarda_inspecao';

  const lat = resumo?.foco.latitude ?? foco.latitude ?? imovel?.latitude ?? null;
  const lng = resumo?.foco.longitude ?? foco.longitude ?? imovel?.longitude ?? null;

  const enderecoDisplay = (() => {
    if (imovel?.logradouro) {
      return [imovel.logradouro, imovel.numero, imovel.bairro].filter(Boolean).join(', ');
    }
    return resumo?.foco.enderecoNormalizado ?? foco.enderecoNormalizado ?? 'Endereço não informado';
  })();

  const scoreOperacional = foco.scorePrioridade;
  const istiInfo = istiClassificacao(scoreOperacional);

  const equipeNome = (() => {
    const p = (foco as { payload?: Record<string, unknown> }).payload;
    if (!p) return null;
    for (const k of ['equipeNome', 'equipe_nome', 'equipe'] as const) {
      const v = p[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return null;
  })();

  return (
    <div className="max-w-7xl mx-auto px-4 pt-2 pb-10 space-y-3">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <Card className="border-border/80 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="relative px-4 py-3 sm:px-5 sm:py-3.5 space-y-2">
            {/* Navegação prev/next — canto superior direito */}
            <div className="absolute top-3 right-4 sm:top-3.5 sm:right-5 flex items-center gap-1 z-10">
              <Button
                variant="outline" size="icon"
                className="h-8 w-8 shrink-0 rounded-sm border-border/80"
                disabled={!prevId}
                onClick={() => prevId && navegarParaFoco(prevId, navCtx!.index - 1)}
                aria-label="Foco anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline" size="icon"
                className="h-8 w-8 shrink-0 rounded-sm border-border/80"
                disabled={!nextId}
                onClick={() => nextId && navegarParaFoco(nextId, navCtx!.index + 1)}
                aria-label="Próximo foco"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between lg:gap-3">
              <div className="min-w-0 flex flex-col gap-0.5 pr-20">
                <Button type="button" variant="ghost" size="sm"
                  className="h-auto w-fit -ml-2 px-1.5 py-0.5 gap-1 text-[11px] font-medium leading-none text-muted-foreground/70 hover:text-foreground hover:bg-muted/40"
                  onClick={() => navigate('/gestor/focos')} aria-label="Voltar para lista de focos"
                >
                  <ArrowLeft className="w-3.5 h-3.5 shrink-0 opacity-70" aria-hidden />
                  Voltar
                </Button>
                <div className="space-y-0">
                  <p className="text-[11px] text-muted-foreground font-medium tracking-wide leading-tight pb-0.5">Ocorrência</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl sm:text-[1.65rem] font-bold font-mono text-foreground tracking-tight leading-tight">
                      {codigoStr}
                    </h1>
                    {resumo?.foco.protocoloPublico && (
                      <span className="text-sm text-muted-foreground font-mono">{resumo.foco.protocoloPublico}</span>
                    )}
                    <button type="button" title="Copiar código"
                      onClick={() => { navigator.clipboard.writeText(codigoStr); toast.success('Código copiado'); }}
                      className="p-1.5 rounded-sm hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              {mostrarEncaminhar && (
                <div className="flex items-center gap-2 shrink-0">
                  <Button className="rounded-sm bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm gap-2 px-4" onClick={() => navigate(`/gestor/focos/${id}`)}>
                    {foco.status === 'em_triagem' ? 'Encaminhar para inspeção' : 'Re-atribuir agente'}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-3 gap-y-2 pt-1.5 border-t border-border/60">
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground font-medium">Prioridade</p>
                {foco.prioridade ? (
                  <PrioridadeBadge prioridade={foco.prioridade as never} className="rounded-sm px-2.5 py-0.5 text-xs font-bold" />
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground font-medium">Status atual</p>
                <div className="flex items-center gap-2 min-h-[24px]">
                  <span className="w-2 h-2 rounded-sm shrink-0 ring-2 ring-white shadow" style={{ backgroundColor: statusHex }} />
                  <span className="text-sm font-semibold" style={{ color: statusHex }}>{statusLabel}</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground font-medium">Classificação</p>
                <p className="text-sm font-semibold text-red-600 dark:text-red-400 leading-snug">{focoLabel}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground font-medium">Origem</p>
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {origemIcon(foco.origemTipo)}
                  <span>{LABEL_ORIGEM[foco.origemTipo] ?? foco.origemTipo}</span>
                </div>
              </div>
              <div className="space-y-1 col-span-2 lg:col-span-1">
                <p className="text-[11px] text-muted-foreground font-medium">Endereço</p>
                <div className="flex items-start gap-2 text-sm text-foreground/90">
                  <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="leading-snug">{enderecoDisplay}</span>
                </div>
              </div>
            </div>

            {resumo?.vistoria && (
              <div className="flex items-center gap-4 pt-1 border-t border-border/60 text-[11px] text-muted-foreground">
                <span>Visita: <span className="font-medium text-foreground">{formatDate(resumo.vistoria.dataVisita)}</span></span>
                {resumo.vistoria.origemVisita && (
                  <span>Origem: <span className="font-medium text-foreground capitalize">{resumo.vistoria.origemVisita}</span></span>
                )}
                {!resumo.vistoria.acessoRealizado && (
                  <span className="text-orange-600 font-medium">Sem acesso{resumo.vistoria.motivoSemAcesso ? ` — ${resumo.vistoria.motivoSemAcesso}` : ''}</span>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-border/60 bg-muted/20 px-3 sm:px-5 py-2.5">
            <RelatorioStatusStepper currentStatus={foco.status} />
          </div>
        </CardContent>
      </Card>

      {/* ── Estado vazio: sem vistoria ──────────────────────────────────── */}
      {!resumoLoading && resumo?.vistoria === null && (
        <Card className="border-border/60 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center gap-2">
            <Building2 className="h-8 w-8 text-muted-foreground/40" aria-hidden />
            <p className="text-sm font-medium text-foreground">Este foco ainda não possui vistoria vinculada.</p>
            <p className="text-xs text-muted-foreground">Quando uma vistoria for realizada e vinculada ao foco, os dados aparecem aqui.</p>
          </CardContent>
        </Card>
      )}

      {/* ── Resumo estratégico (tiles superiores) ──────────────────────── */}
      {resumoLoading ? (
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-sm" />)}
        </div>
      ) : resumo ? (
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          <EstrategicoTile value={resumo.resumoEstrategico.moradoresExpostos ?? '—'} label="Moradores expostos" variant={resumo.resumoEstrategico.moradoresExpostos ? 'green' : 'blue'} />
          <EstrategicoTile value={resumo.resumoEstrategico.gruposVulneraveisQtd || '—'} label="Grupos vulneráveis" variant={resumo.resumoEstrategico.gruposVulneraveisQtd > 0 ? 'orange' : 'blue'} />
          <EstrategicoTile value={resumo.resumoEstrategico.sintomasInformadosQtd || '—'} label="Sintomas relatados" variant={resumo.resumoEstrategico.sintomasInformadosQtd > 0 ? 'orange' : 'blue'} />
          <EstrategicoTile value={resumo.resumoEstrategico.depositosComFocoQtd || '—'} label="Depósitos com foco" variant={resumo.resumoEstrategico.depositosComFocoQtd > 0 ? 'red' : 'blue'} />
          <EstrategicoTile value={resumo.resumoEstrategico.depositosComAguaQtd || '—'} label="Depósitos com água" variant={resumo.resumoEstrategico.depositosComAguaQtd > 0 ? 'orange' : 'blue'} />
          <EstrategicoTile value={resumo.resumoEstrategico.calhasCriticasQtd || '—'} label="Calhas críticas" variant={resumo.resumoEstrategico.calhasCriticasQtd > 0 ? 'orange' : 'blue'} />
          <EstrategicoTile value={resumo.resumoEstrategico.fatoresRiscoAtivosQtd || '—'} label="Fatores de risco" variant={resumo.resumoEstrategico.fatoresRiscoAtivosQtd > 0 ? 'orange' : 'blue'} />
          <EstrategicoTile value={resumo.consolidacao?.prioridadeFinal ?? '—'} label="Prioridade final" variant={resumo.consolidacao?.prioridadeFinal ? 'green' : 'blue'} />
        </div>
      ) : null}

      {/* ── Cards de vistoria (só se houver vistoria) ───────────────────── */}
      {resumo?.vistoria && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MoradoresCard moradores={resumo.moradores} />
            <GruposVulneraveisCard grupos={resumo.gruposVulneraveis} />
            <SintomasCard sintomas={resumo.sintomas} />
            <DepositosCard depositosPncd={resumo.depositosPncd} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <CalhasCard calhas={resumo.calhas} />
            <TratamentoCard tratamento={resumo.tratamento} />
            <FatoresRiscoCard fatoresRisco={resumo.fatoresRisco} />

            {/* ISTI */}
            <Card className="border-border/60 shadow-sm overflow-hidden">
              <CardHeader className="pb-0 pt-4 px-4">
                <CardTitle className="text-sm font-semibold leading-snug text-foreground tracking-tight">
                  Índice Sanitário (ISTI)
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col px-4 pb-4 pt-1">
                <IstiGauge score={scoreOperacional} />
                <div className="mt-1 flex items-center justify-between gap-3 border-t border-border/50 pt-3">
                  <span className="text-xs text-muted-foreground">Classificação</span>
                  <span className={cn('inline-flex shrink-0 rounded-sm px-2.5 py-1 text-xs font-bold', istiInfo.badgeClass)}>
                    {istiInfo.label}
                  </span>
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="mt-3 inline-flex items-center justify-center gap-1.5 self-center text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      Como é calculado
                      <Info className="h-4 w-4 shrink-0" aria-hidden />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="center" className="space-y-3 text-sm">
                    <p className="font-semibold text-foreground">ISTI — Índice de Severidade (0–100)</p>
                    <p className="text-xs text-muted-foreground">
                      Pontuação operacional que mede a urgência de atendimento do foco. Composta por três fatores:
                    </p>
                    <ul className="space-y-2 border-t border-border/60 pt-2">
                      <li className="space-y-0.5">
                        <p className="text-xs font-semibold">SLA — prazo consumido (10–50 pts)</p>
                        <p className="text-[11px] text-muted-foreground">10 pts se abaixo de 70% do prazo · 20 pts entre 70–90% · 40 pts acima de 90% · 50 pts se vencido</p>
                      </li>
                      <li className="space-y-0.5">
                        <p className="text-xs font-semibold">Reincidência (+20 pts)</p>
                        <p className="text-[11px] text-muted-foreground">Acrescido quando há registro de foco anterior no mesmo local</p>
                      </li>
                      <li className="space-y-0.5">
                        <p className="text-xs font-semibold">Casos próximos (+5 pts por caso, máx 30 pts)</p>
                        <p className="text-[11px] text-muted-foreground">Casos de arbovirose notificados nas proximidades do foco</p>
                      </li>
                    </ul>
                    <p className="text-[11px] text-muted-foreground border-t border-border/60 pt-2">
                      Focos resolvidos ou descartados recebem pontuação 0.
                    </p>
                  </PopoverContent>
                </Popover>
              </CardContent>
            </Card>
          </div>

          <ConsolidacaoCard consolidacao={resumo.consolidacao} />
          <ExplicabilidadeCard explicabilidade={resumo.explicabilidade} />
        </>
      )}

      {/* ── Localização ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className="border-border/60">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-foreground">Localização do imóvel</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {resumo?.vistoria?.fotoExternaUrl && (
              <div className="mb-3 overflow-hidden rounded-sm border border-border/60">
                <img src={resumo.vistoria.fotoExternaUrl} alt="Foto da fachada" className="w-full max-h-40 object-cover" />
                <p className="px-2 py-1 text-[10px] text-muted-foreground bg-muted/40">Foto da fachada</p>
              </div>
            )}
            {lat && lng ? (
              <MapaSimples lat={lat} lng={lng} className="h-full min-h-[200px]" />
            ) : (
              <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-border bg-muted/50 py-10">
                <MapPin className="mb-1 h-6 w-6 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Coordenadas não disponíveis</p>
              </div>
            )}
            {imovel && (
              <div className="mt-3 flex flex-wrap gap-4 text-xs">
                <div><p className="text-[10px] text-muted-foreground">Tipo de imóvel</p><p className="font-medium capitalize">{imovel.tipoImovel}</p></div>
                {imovel.bairro && <div><p className="text-[10px] text-muted-foreground">Bairro</p><p className="font-medium">{imovel.bairro}</p></div>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dados da vistoria (resumo rápido) */}
        <Card className="border-border/60">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-foreground">Dados da vistoria</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3 text-sm">
            {!resumo?.vistoria ? (
              <p className="text-xs text-muted-foreground">Sem vistoria vinculada.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <InfoRow label="Data da visita" value={formatDate(resumo.vistoria.dataVisita)} />
                <InfoRow label="Status" value={resumo.vistoria.status} />
                <InfoRow label="Acesso realizado" value={resumo.vistoria.acessoRealizado ? 'Sim' : 'Não'} />
                {resumo.vistoria.habitatSelecionado && <InfoRow label="Habitat" value={resumo.vistoria.habitatSelecionado} />}
                {resumo.vistoria.condicaoHabitat && <InfoRow label="Condição" value={resumo.vistoria.condicaoHabitat} />}
                {resumo.vistoria.origemVisita && <InfoRow label="Origem da visita" value={resumo.vistoria.origemVisita} />}
                {resumo.consolidacao?.consolidadoEm && <InfoRow label="Consolidado em" value={formatDate(resumo.consolidacao.consolidadoEm)} />}
                {resumo.foco.observacao && <div className="col-span-2"><InfoRow label="Observação do foco" value={resumo.foco.observacao} /></div>}
                {resumo.vistoria.observacao && <div className="col-span-2"><InfoRow label="Observação da vistoria" value={resumo.vistoria.observacao} /></div>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="evidencias" className="mt-2">
        <TabsList className="inline-flex h-auto w-full min-h-10 flex-wrap gap-0 rounded-none border-b border-border/60 bg-transparent p-0 text-muted-foreground">
          {[
            { value: 'evidencias', label: 'Evidências', count: resumo?.evidencias.length ?? 0 },
            { value: 'historico', label: 'Histórico', count: resumo?.historico.length ?? 0 },
            { value: 'ocorrencia', label: 'Dados da ocorrência', count: 0 },
          ].map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}
              className="rounded-none border-b-2 border-transparent px-3 py-2 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary"
            >
              {tab.label}
              <TabCountBadge count={tab.count} />
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="evidencias" className="mt-4">
          {resumoLoading ? (
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-sm" />)}
            </div>
          ) : (
            <EvidenciasTab evidencias={resumo?.evidencias ?? []} />
          )}
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          {resumoLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-sm" />)}
            </div>
          ) : (
            <HistoricoTab historico={resumo?.historico ?? []} />
          )}
        </TabsContent>

        <TabsContent value="ocorrencia" className="mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="space-y-3 md:border-r md:border-border/50 md:pr-4">
              <h3 className="font-semibold text-xs uppercase text-muted-foreground tracking-wide">Dados da ocorrência</h3>
              <InfoRow label="Criada em" value={formatDatetime(foco.createdAt)} />
              <InfoRow label="Criada por" value={LABEL_ORIGEM[foco.origemTipo] ?? foco.origemTipo} />
              <InfoRow label="Suspeita em" value={formatDatetime(foco.suspeitaEm)} />
              <InfoRow label="Inspeção em" value={formatDatetime(foco.inspecaoEm)} />
              <InfoRow label="Confirmado em" value={formatDatetime(foco.confirmadoEm)} />
              <InfoRow label="Resolvido em" value={formatDatetime(foco.resolvidoEm)} />
              <InfoRow label="Ciclo" value={foco.ciclo?.toString() ?? '—'} />
              <InfoRow label="Casos vinculados" value={casosCount.toString()} />
            </div>
            <div className="space-y-3 md:border-r md:border-border/50 md:pr-4">
              <h3 className="font-semibold text-xs uppercase text-muted-foreground tracking-wide">Dados do imóvel</h3>
              <InfoRow label="Tipo de imóvel" value={imovel?.tipoImovel ?? '—'} />
              <InfoRow label="Situação" value={imovel?.proprietarioAusente ? 'Proprietário ausente' : 'Ocupado'} />
              <InfoRow label="Animal agressivo" value={imovel?.temAnimalAgressivo ? 'Sim' : 'Não'} />
              <InfoRow label="Histórico recusa" value={imovel?.historicoRecusa ? 'Sim' : 'Não'} />
              <InfoRow label="Tem calha" value={imovel?.temCalha ? 'Sim' : 'Não'} />
              <InfoRow label="Calha acessível" value={imovel?.calhaAcessivel ? 'Sim' : 'Não'} />
              {imovel?.bairro && <InfoRow label="Bairro" value={imovel.bairro} />}
              {imovel?.quarteirao && <InfoRow label="Quarteirão" value={imovel.quarteirao} />}
            </div>
            <div className="space-y-3 md:border-r md:border-border/50 md:pr-4">
              <h3 className="font-semibold text-xs uppercase text-muted-foreground tracking-wide">Responsável</h3>
              <InfoRow label="Agente responsável" value={foco.responsavel?.nome ?? '—'} />
              <InfoRow label="Equipe" value={equipeNome ?? '—'} />
              <InfoRow label="E-mail" value={foco.responsavel?.email ?? '—'} />
            </div>
            <div className="space-y-3">
              <h3 className="font-semibold text-xs uppercase text-muted-foreground tracking-wide">Observações</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {foco.observacao ?? (foco as { desfecho?: string }).desfecho ?? 'Nenhuma observação registrada'}
              </p>
              {resumo?.consolidacao?.consolidacaoResumo && (
                <>
                  <h3 className="font-semibold text-xs uppercase text-muted-foreground tracking-wide pt-2">Consolidação</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{resumo.consolidacao.consolidacaoResumo}</p>
                </>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
