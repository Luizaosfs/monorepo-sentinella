import { useMemo, type ComponentType, type ReactNode } from 'react';
import {
  Filter,
  Calendar,
  MapPin,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Crosshair,
  X,
  ChevronLeft,
  Sparkles,
  RotateCcw,
  PanelLeftClose,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { FocoRiscoOrigem, FocoRiscoPrioridade, FocoRiscoStatus } from '@/types/database';
import { COR_STATUS, LABEL_ORIGEM, LABEL_SLA, LABEL_STATUS } from '@/types/focoRisco';
import type { GestorMapaFocoFilterState, GestorMapaFocoStats, PeriodoGestorMapa, ScoreClassificacaoFiltro } from '@/lib/gestorMapaFocoFilters';
import { DEFAULT_GESTOR_MAPA_FILTERS, countGestorMapaFilterSelections } from '@/lib/gestorMapaFocoFilters';
import type { Regiao } from '@/types/database';

const PERIODOS: { id: PeriodoGestorMapa; label: string; short: string }[] = [
  { id: 'all', label: 'Todos', short: 'Todos' },
  { id: 'hoje', label: 'Hoje', short: 'Hoje' },
  { id: '7d', label: '7 dias', short: '7d' },
  { id: '30d', label: '30 dias', short: '30d' },
];

const STATUS_MAPA: FocoRiscoStatus[] = [
  'suspeita',
  'em_triagem',
  'aguarda_inspecao',
  'em_inspecao',
  'confirmado',
  'em_tratamento',
];

const PRIORIDADES: FocoRiscoPrioridade[] = ['P1', 'P2', 'P3', 'P4', 'P5'];

const ORIGENS: FocoRiscoOrigem[] = ['drone', 'agente', 'cidadao', 'pluvio', 'manual'];

const SLA_OPTS: Array<'ok' | 'atencao' | 'critico' | 'vencido' | 'sem_sla'> = [
  'ok',
  'atencao',
  'critico',
  'vencido',
  'sem_sla',
];

/** Estilo ativo por prioridade (reflete urgência) */
const PRIORIDADE_ACTIVE: Record<FocoRiscoPrioridade, string> = {
  P1: 'border-red-500/60 bg-red-500/15 text-red-700 dark:text-red-300 shadow-sm ring-1 ring-red-500/20',
  P2: 'border-orange-500/60 bg-orange-500/15 text-orange-800 dark:text-orange-300 shadow-sm ring-1 ring-orange-500/20',
  P3: 'border-amber-500/50 bg-amber-500/12 text-amber-900 dark:text-amber-200 shadow-sm',
  P4: 'border-sky-500/50 bg-sky-500/10 text-sky-900 dark:text-sky-200 shadow-sm',
  P5: 'border-slate-400/50 bg-slate-500/10 text-slate-800 dark:text-slate-200 shadow-sm',
};

const SCORE_OPTS: Array<{ key: ScoreClassificacaoFiltro; label: string; chip: string }> = [
  { key: 'critico',    label: 'Crítico',    chip: 'border-red-700/50 bg-red-700/15 text-red-800 dark:text-red-200' },
  { key: 'muito_alto', label: 'Muito Alto', chip: 'border-red-500/50 bg-red-500/15 text-red-700 dark:text-red-300' },
  { key: 'alto',       label: 'Alto',       chip: 'border-orange-500/50 bg-orange-500/15 text-orange-800 dark:text-orange-200' },
  { key: 'medio',      label: 'Médio',      chip: 'border-amber-500/50 bg-amber-500/15 text-amber-800 dark:text-amber-200' },
  { key: 'baixo',      label: 'Baixo',      chip: 'border-emerald-500/45 bg-emerald-500/12 text-emerald-800 dark:text-emerald-300' },
];

const SLA_CHIP: Record<string, string> = {
  ok: 'border-emerald-500/45 bg-emerald-500/[0.12] text-emerald-800 dark:text-emerald-300',
  atencao: 'border-amber-500/45 bg-amber-500/[0.12] text-amber-900 dark:text-amber-200',
  critico: 'border-orange-500/45 bg-orange-500/[0.12] text-orange-900 dark:text-orange-200',
  vencido: 'border-red-500/50 bg-red-500/[0.12] text-red-800 dark:text-red-300',
  sem_sla: 'border-muted-foreground/35 bg-muted/80 text-muted-foreground',
};

interface Props {
  stats: GestorMapaFocoStats;
  totalFocosCarregados: number;
  filters: GestorMapaFocoFilterState;
  onChange: (next: GestorMapaFocoFilterState) => void;
  regioes: Regiao[];
  mobileOpen: boolean;
  onMobileClose: () => void;
  onCollapse: () => void;
}

function SectionLabel({ icon: Icon, children }: { icon: ComponentType<{ className?: string }>; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold text-foreground tracking-tight">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-3.5 w-3.5" />
      </span>
      {children}
    </div>
  );
}

function GestorMapaKpiRow({ stats }: { stats: GestorMapaFocoStats }) {
  const kpis = [
    {
      label: 'No mapa',
      value: stats.total,
      icon: MapPin,
      accent: 'from-primary/15 to-primary/5',
      iconClass: 'text-primary',
    },
    {
      label: 'P1 + P2',
      value: stats.urgentesP1P2,
      icon: ShieldAlert,
      accent: 'from-red-500/15 to-red-500/5',
      iconClass: 'text-red-600 dark:text-red-400',
    },
    {
      label: 'Regiões',
      value: stats.regioesDistintas,
      icon: Crosshair,
      accent: 'from-orange-500/15 to-orange-500/5',
      iconClass: 'text-orange-600 dark:text-orange-400',
    },
    {
      label: 'SLA em risco',
      value: stats.slaEmRisco,
      icon: AlertTriangle,
      accent: 'from-amber-500/15 to-amber-500/5',
      iconClass: 'text-amber-600 dark:text-amber-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {kpis.map((kpi, idx) => (
        <Card
          key={idx}
          className={cn(
            'overflow-hidden border-border/50 shadow-none bg-gradient-to-br',
            kpi.accent,
          )}
        >
          <CardContent className="p-3">
            <div className="flex items-start justify-between gap-2">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground leading-tight">
                {kpi.label}
              </span>
              <kpi.icon className={cn('h-4 w-4 shrink-0 opacity-90', kpi.iconClass)} aria-hidden />
            </div>
            <div className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight text-foreground">{kpi.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function GestorMapaFiltersPanel({
  stats,
  totalFocosCarregados,
  filters,
  onChange,
  regioes,
  mobileOpen,
  onMobileClose,
  onCollapse,
}: Props) {
  const activeCount = useMemo(() => countGestorMapaFilterSelections(filters), [filters]);
  const hasActiveFilters = activeCount > 0;

  const toggle = <K extends keyof GestorMapaFocoFilterState>(
    key: K,
    value: GestorMapaFocoFilterState[K] extends (infer U)[] ? U : never,
  ) => {
    const arr = filters[key] as unknown as string[];
    if (!Array.isArray(arr)) return;
    const v = value as string;
    const nextArr = arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
    onChange({ ...filters, [key]: nextArr } as GestorMapaFocoFilterState);
  };

  const reset = () => onChange({ ...DEFAULT_GESTOR_MAPA_FILTERS });

  return (
    <>
      <div
        className={cn(
          'bg-card shadow-2xl border-border/60 z-[530] flex min-h-0 flex-col shrink-0',
          'fixed bottom-0 inset-x-0 rounded-t-[1.25rem] border-t transition-transform duration-300 ease-out',
          'h-[min(78vh,820px)] lg:h-full',
          mobileOpen ? 'translate-y-0' : 'translate-y-full',
          'lg:static lg:translate-y-0 lg:w-[340px] lg:rounded-none lg:border-t-0 lg:border-r lg:shadow-xl',
        )}
      >
        {/* Mobile header */}
        <div className="relative flex shrink-0 items-center justify-between border-b border-border/60 px-4 pb-3 pt-2 lg:hidden">
          <div className="pointer-events-none absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-muted-foreground/25" />
          <div className="mt-2 min-w-0 flex-1 pr-2">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                <Filter className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-bold leading-tight text-foreground">Filtros do mapa</h2>
                <p className="text-[11px] text-muted-foreground">Focos ativos</p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onMobileClose}
            className="mt-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/90 text-muted-foreground transition-colors hover:bg-muted"
            aria-label="Fechar filtros"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Desktop header */}
        <div className="hidden shrink-0 items-center justify-between gap-3 border-b border-border/60 bg-gradient-to-r from-muted/40 to-muted/10 px-4 py-3.5 lg:flex">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
              <MapPin className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight text-foreground">Filtros</h2>
                {hasActiveFilters && (
                  <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                    {activeCount}
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground">Mapa de focos — refine o que aparece no mapa</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-lg border-border/60"
            onClick={onCollapse}
            title="Ocultar painel de filtros"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-4 p-4 pb-2 lg:px-4 lg:pt-4">
            <GestorMapaKpiRow stats={stats} />

            {hasActiveFilters && stats.total !== totalFocosCarregados && (
              <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs leading-snug text-foreground">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span>
                  Mostrando <strong className="tabular-nums">{stats.total}</strong> de{' '}
                  <strong className="tabular-nums">{totalFocosCarregados}</strong> focos carregados. Os números acima
                  refletem só o que passou pelos filtros.
                </span>
              </div>
            )}

            {/* Local + tempo */}
            <div className="space-y-3 rounded-xl border border-border/50 bg-muted/25 p-3.5">
              <SectionLabel icon={MapPin}>Região</SectionLabel>
              <Select
                value={filters.regiaoId}
                onValueChange={(v) =>
                  onChange({ ...filters, regiaoId: v as GestorMapaFocoFilterState['regiaoId'] })
                }
              >
                <SelectTrigger className="h-10 w-full rounded-lg border-border/60 bg-background text-sm font-medium shadow-sm">
                  <SelectValue placeholder="Todas as regiões" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as regiões</SelectItem>
                  {regioes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.regiao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Separator className="bg-border/60" />

              <SectionLabel icon={Calendar}>Data da suspeita</SectionLabel>
              <p className="-mt-1 text-[11px] text-muted-foreground">Filtra pelo registro inicial do foco</p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {PERIODOS.map((p) => {
                  const on = filters.periodo === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onChange({ ...filters, periodo: p.id })}
                      className={cn(
                        'rounded-lg px-2 py-2 text-center text-xs font-semibold transition-all',
                        'border border-transparent',
                        on
                          ? 'border-primary/40 bg-background text-foreground shadow-sm ring-1 ring-primary/25'
                          : 'bg-background/60 text-muted-foreground hover:bg-background hover:text-foreground',
                      )}
                    >
                      <span className="sm:hidden">{p.short}</span>
                      <span className="hidden sm:inline">{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <Accordion type="multiple" defaultValue={[]} className="space-y-2 rounded-xl border border-border/50 px-1">
              <AccordionItem value="status" className="border-b-0">
                <AccordionTrigger className="rounded-lg px-2 py-3 text-sm font-semibold hover:no-underline [&[data-state=open]]:bg-muted/40">
                  <span className="flex items-center gap-2">
                    <Crosshair className="h-4 w-4 text-primary" />
                    Status do foco
                    {filters.status.length > 0 && (
                      <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                        {filters.status.length}
                      </span>
                    )}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-2 pb-3 pt-0">
                  <div className="grid grid-cols-1 gap-1.5">
                    {STATUS_MAPA.map((st) => {
                      const active = filters.status.includes(st);
                      const dot = COR_STATUS[st] ?? '#888';
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => toggle('status', st)}
                          aria-pressed={active}
                          className={cn(
                            'flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-all',
                            'border-border/50 bg-background/80',
                            active
                              ? 'border-primary/45 bg-primary/[0.07] shadow-sm ring-1 ring-primary/15'
                              : 'hover:border-border hover:bg-muted/50',
                          )}
                          style={{ borderLeftWidth: 4, borderLeftColor: dot }}
                        >
                          <span
                            className="h-2 w-2 shrink-0 rounded-full ring-2 ring-background"
                            style={{ backgroundColor: dot }}
                          />
                          {LABEL_STATUS[st] ?? st}
                        </button>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="prioridade" className="border-b-0">
                <AccordionTrigger className="rounded-lg px-2 py-3 text-sm font-semibold hover:no-underline [&[data-state=open]]:bg-muted/40">
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    Prioridade
                    {filters.prioridade.length > 0 && (
                      <span className="rounded-full bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-bold text-orange-700 dark:text-orange-300">
                        {filters.prioridade.length}
                      </span>
                    )}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-2 pb-3 pt-0">
                  <p className="mb-2 text-[11px] text-muted-foreground">Toque para combinar (ex.: só P1 e P2)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {PRIORIDADES.map((pr) => {
                      const active = filters.prioridade.includes(pr);
                      return (
                        <button
                          key={pr}
                          type="button"
                          aria-pressed={active}
                          onClick={() => toggle('prioridade', pr)}
                          className={cn(
                            'min-w-[2.5rem] flex-1 rounded-lg border px-2 py-2 text-center text-xs font-bold transition-all',
                            'border-border/60 bg-background/80',
                            active ? PRIORIDADE_ACTIVE[pr] : 'text-muted-foreground hover:bg-muted/60',
                          )}
                        >
                          {pr}
                        </button>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="origem" className="border-b-0">
                <AccordionTrigger className="rounded-lg px-2 py-3 text-sm font-semibold hover:no-underline [&[data-state=open]]:bg-muted/40">
                  <span className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-sky-600" />
                    Origem
                    {filters.origem.length > 0 && (
                      <span className="rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold text-sky-800 dark:text-sky-300">
                        {filters.origem.length}
                      </span>
                    )}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-2 pb-3 pt-0">
                  <div className="grid grid-cols-2 gap-1.5">
                    {ORIGENS.map((o) => {
                      const active = filters.origem.includes(o);
                      return (
                        <button
                          key={o}
                          type="button"
                          aria-pressed={active}
                          onClick={() => toggle('origem', o)}
                          className={cn(
                            'rounded-lg border px-2 py-2.5 text-center text-xs font-semibold transition-all',
                            active
                              ? 'border-sky-500/45 bg-sky-500/10 text-sky-900 shadow-sm dark:text-sky-100'
                              : 'border-border/50 bg-background/80 text-muted-foreground hover:bg-muted/50',
                          )}
                        >
                          {LABEL_ORIGEM[o] ?? o}
                        </button>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="sla" className="border-b-0">
                <AccordionTrigger className="rounded-lg px-2 py-3 text-sm font-semibold hover:no-underline [&[data-state=open]]:bg-muted/40">
                  <span className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                    Situação do SLA
                    {filters.slaStatus.length > 0 && (
                      <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                        {filters.slaStatus.length}
                      </span>
                    )}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-2 pb-2 pt-0">
                  <div className="flex flex-wrap gap-1.5">
                    {SLA_OPTS.map((s) => {
                      const active = filters.slaStatus.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          aria-pressed={active}
                          onClick={() => toggle('slaStatus', s)}
                          className={cn(
                            'rounded-md border px-2.5 py-1.5 text-[11px] font-semibold transition-all',
                            active ? SLA_CHIP[s] : 'border-border/50 bg-muted/30 text-muted-foreground hover:bg-muted/60',
                          )}
                        >
                          {LABEL_SLA[s]}
                        </button>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="score" className="border-0">
                <AccordionTrigger className="rounded-lg px-2 py-3 text-sm font-semibold hover:no-underline [&[data-state=open]]:bg-muted/40">
                  <span className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                    Score territorial
                    {filters.scoreClassificacao.length > 0 && (
                      <span className="rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-bold text-violet-800 dark:text-violet-300">
                        {filters.scoreClassificacao.length}
                      </span>
                    )}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-2 pb-2 pt-0">
                  <p className="mb-2 text-[11px] text-muted-foreground">Filtra imóveis pelo nível de risco calculado</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SCORE_OPTS.map(({ key, label, chip }) => {
                      const active = filters.scoreClassificacao.includes(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          aria-pressed={active}
                          onClick={() => toggle('scoreClassificacao', key)}
                          className={cn(
                            'rounded-md border px-2.5 py-1.5 text-[11px] font-semibold transition-all',
                            active ? chip : 'border-border/50 bg-muted/30 text-muted-foreground hover:bg-muted/60',
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="hidden h-2 lg:block" />
          </div>
        </ScrollArea>

        {/* Rodapé ações — sticky no mobile */}
        <div className="shrink-0 space-y-2 border-t border-border/60 bg-gradient-to-t from-card via-card to-card/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:rounded-none">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 flex-1 gap-1.5 rounded-lg font-medium"
              onClick={reset}
              disabled={!hasActiveFilters}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Limpar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-10 flex-1 rounded-lg text-muted-foreground lg:hidden"
              onClick={onCollapse}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Ocultar painel
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
