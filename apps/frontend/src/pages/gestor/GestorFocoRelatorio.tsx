import { useEffect, useId, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeft,
  ArrowRight,
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
  Trash2,
  TreeDeciduous,
  RefreshCw,
  Image,
  Wrench,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useFocoDetalhes, type FocoDetalhes } from '@/hooks/queries/useFocoDetalhes';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { useEvidenciasFoco, useFocoRisco, useFocoRiscoTimeline } from '@/hooks/queries/useFocosRisco';
import { FocoRiscoTimeline } from '@/components/foco/FocoRiscoTimeline';
import { PrioridadeBadge } from '@/components/foco/PrioridadeBadge';
import { COR_STATUS, LABEL_STATUS, LABEL_ORIGEM } from '@/types/focoRisco';
import { LABEL_CLASSIFICACAO_INICIAL } from '@/types/database';
import type { FocoRiscoClassificacao, FocoRiscoStatus } from '@/types/database';

// ── Stepper 8 etapas (alinhado ao fluxo operacional + “Em rota” como etapa visual) ─

const RELATORIO_STEPS: { id: string; label: string }[] = [
  { id: 'suspeita', label: 'Suspeita' },
  { id: 'em_triagem', label: 'Em triagem' },
  { id: 'aguarda_inspecao', label: 'Aguarda inspeção' },
  { id: 'em_rota', label: 'Em rota' },
  { id: 'em_inspecao', label: 'Em inspeção' },
  { id: 'confirmado', label: 'Confirmado / Descartado' },
  { id: 'em_tratamento', label: 'Em tratamento' },
  { id: 'resolvido', label: 'Resolvido' },
];

/** Índice 0–7 da etapa atual no stepper do relatório. */
function statusToRelatorioStepIndex(status: string): number {
  const s = status as FocoRiscoStatus;
  if (s === 'descartado') return 5;
  const map: Record<FocoRiscoStatus, number> = {
    suspeita: 0,
    em_triagem: 1,
    aguarda_inspecao: 2,
    em_inspecao: 4,
    confirmado: 5,
    em_tratamento: 6,
    resolvido: 7,
    descartado: 5,
  };
  return map[s] ?? 0;
}

function RelatorioStatusStepper({ currentStatus }: { currentStatus: string }) {
  const effectiveIdx = statusToRelatorioStepIndex(currentStatus);
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
                <div
                  className={cn(
                    'w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors',
                    done && 'bg-green-500 border-green-500 text-white',
                    current && !done && 'bg-green-600 border-green-600 text-white shadow-sm',
                    pending && 'bg-muted/80 border-muted-foreground/25 text-muted-foreground',
                  )}
                >
                  {done ? <Check className="w-4 h-4 stroke-[3]" /> : idx + 1}
                </div>
                <span
                  className={cn(
                    'mt-1.5 text-[10px] sm:text-[11px] font-medium text-center leading-tight px-0.5',
                    (done || current) && 'text-green-700 dark:text-green-400',
                    pending && 'text-muted-foreground',
                  )}
                >
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
                <div
                  className={cn(
                    'h-0.5 w-5 sm:w-8 mt-4 shrink-0 self-start rounded-full',
                    idx < effectiveIdx || (isResolvido && idx === RELATORIO_STEPS.length - 2)
                      ? 'bg-green-500'
                      : 'bg-[repeating-linear-gradient(90deg,hsl(var(--border))_0px,hsl(var(--border))_4px,transparent_4px,transparent_8px)]',
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function origemIcon(tipo: string) {
  switch (tipo) {
    case 'drone':
      return <Plane className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden />;
    case 'agente':
      return <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden />;
    case 'pluvio':
      return <CloudRain className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden />;
    case 'manual':
      return <Pencil className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden />;
    default:
      return <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden />;
  }
}

// ── ISTI Gauge (semicírculo, gradiente vermelho → laranja, valor central) ─────

function IstiGauge({ score }: { score: number }) {
  const gradId = `isti-grad-${useId().replace(/:/g, '')}`;
  const clamped = Math.max(0, Math.min(100, score));
  const r = 42;
  const arcLen = Math.PI * r;
  const filled = (clamped / 100) * arcLen;

  return (
    <div className="relative mx-auto h-[132px] w-full max-w-[220px]">
      <svg
        viewBox="0 0 100 58"
        className="absolute bottom-0 left-0 w-full max-h-[72px]"
        aria-hidden
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#dc2626" />
            <stop offset="50%" stopColor="#ea580c" />
            <stop offset="100%" stopColor="#fb923c" />
          </linearGradient>
        </defs>
        <path
          d="M 8 52 A 42 42 0 0 1 92 52"
          fill="none"
          stroke="#e4e4e7"
          className="dark:stroke-zinc-600"
          strokeWidth="9"
          strokeLinecap="round"
        />
        {filled > 0.5 && (
          <path
            d="M 8 52 A 42 42 0 0 1 92 52"
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${arcLen}`}
          />
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

// ── Deposit bar chart ─────────────────────────────────────────────────────────

const DEPOSITO_TIPOS = ['A1', 'A2', 'B', 'C', 'D1', 'D2', 'E'] as const;

type Deposito = NonNullable<FocoDetalhes['vistoria']>['depositos'][0];
type VistoriaDetalhe = NonNullable<FocoDetalhes['vistoria']>;

/** Contagens por grupo: prioriza números no payload; senão reparte moradoresQtd entre os flags true; senão 0/1. */
function breakdownGruposMoradores(v: VistoriaDetalhe): { criancas: number; idosos: number; gestantes: number } {
  const p = v.payload;
  const readNum = (...keys: string[]) => {
    if (!p || typeof p !== 'object') return undefined;
    for (const k of keys) {
      const x = (p as Record<string, unknown>)[k];
      if (typeof x === 'number' && Number.isFinite(x) && x >= 0) return Math.floor(x);
    }
    return undefined;
  };
  const cP = readNum('moradores_criancas', 'criancas_qtd', 'qtd_criancas');
  const iP = readNum('moradores_idosos', 'idosos_qtd', 'qtd_idosos');
  const gP = readNum('moradores_gestantes', 'gestantes_qtd', 'qtd_gestantes');
  if (cP !== undefined || iP !== undefined || gP !== undefined) {
    return {
      criancas: cP ?? (v.criancas7anos ? 1 : 0),
      idosos: iP ?? (v.idosos ? 1 : 0),
      gestantes: gP ?? (v.gravidas ? 1 : 0),
    };
  }

  const total = v.moradoresQtd;
  const cFl = !!v.criancas7anos;
  const iFl = !!v.idosos;
  const gFl = !!v.gravidas;
  const onIdx = [cFl, iFl, gFl].map((f, i) => (f ? i : -1)).filter((i) => i >= 0);
  const n = onIdx.length;

  if (total != null && total >= 0 && n > 0) {
    const base = Math.floor(total / n);
    let rem = total % n;
    const o = { criancas: 0, idosos: 0, gestantes: 0 };
    for (const idx of onIdx) {
      const add = base + (rem > 0 ? 1 : 0);
      if (rem > 0) rem -= 1;
      if (idx === 0) o.criancas = add;
      else if (idx === 1) o.idosos = add;
      else o.gestantes = add;
    }
    return o;
  }

  return {
    criancas: cFl ? 1 : 0,
    idosos: iFl ? 1 : 0,
    gestantes: gFl ? 1 : 0,
  };
}

function MoradoresRelatorioCard({ vistoria }: { vistoria: VistoriaDetalhe | null }) {
  if (!vistoria) {
    return (
      <Card className="border-border/60">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600 stroke-[1.75]" />
            <CardTitle className="text-sm font-semibold text-blue-600">Moradores</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Nenhuma vistoria encontrada para este foco. Quando houver visita de campo vinculada ao imóvel ou ao próprio foco, o total e a distribuição por grupo aparecem aqui.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { criancas, idosos, gestantes } = breakdownGruposMoradores(vistoria);
  const total = vistoria.moradoresQtd;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-600 stroke-[1.75]" />
          <CardTitle className="text-sm font-semibold text-blue-600 tracking-tight">Moradores</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-3xl font-bold text-foreground tabular-nums leading-none">
            {total != null ? total : '—'}
          </span>
          <span className="text-sm text-muted-foreground font-medium">Total</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Crianças', value: criancas },
            { label: 'Idosos', value: idosos },
            { label: 'Gestantes', value: gestantes },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-border/80 bg-background px-2 py-2.5 text-center shadow-[0_1px_0_rgba(0,0,0,0.02)]"
            >
              <p className="text-lg font-bold text-foreground tabular-nums leading-tight">{item.value}</p>
              <p className="text-[11px] text-muted-foreground font-medium mt-1">{item.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

type RiscoVistoriaRow = NonNullable<FocoDetalhes['vistoria']>['riscos'][0];
type SintomaRow = NonNullable<FocoDetalhes['vistoria']>['sintomas'][0];

/** Pill de status: ativo verde, alerta laranja, inativo com borda cinza. */
function RelatorioTag({
  label,
  active,
  tone = 'success',
  leadingDot,
}: {
  label: string;
  active: boolean;
  tone?: 'success' | 'warning';
  /** Bolinha à esquerda (ex.: Febre ativa). */
  leadingDot?: boolean;
}) {
  if (!active) {
    return (
      <span className="inline-flex items-center rounded-full border border-border/90 bg-background px-2.5 py-1 text-[11px] font-semibold text-muted-foreground shadow-[0_1px_0_rgba(0,0,0,0.03)]">
        {label}
      </span>
    );
  }
  if (tone === 'warning') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200/90 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-800 dark:border-orange-800/50 dark:bg-orange-950/40 dark:text-orange-200">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" aria-hidden />
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/90 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-100">
      {leadingDot ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden /> : null}
      {label}
    </span>
  );
}

function GruposVulneraveisRelatorioCard({
  risco,
  vistoria,
}: {
  risco: RiscoVistoriaRow | null;
  vistoria: VistoriaDetalhe | null;
}) {
  const idoso = !!(vistoria?.idosos || risco?.idosoIncapaz);
  const crianca = !!(vistoria?.criancas7anos || risco?.menorIncapaz);
  const gestante = !!vistoria?.gravidas;
  const mobilidade = !!risco?.mobilidadeReduzida;
  const acamado = !!risco?.acamado;
  const algum = idoso || crianca || gestante || mobilidade || acamado;
  const semDados = !vistoria && !risco;

  const tags = [
    { label: 'Idoso', active: idoso },
    { label: 'Criança', active: crianca },
    { label: 'Gestante', active: gestante },
    { label: 'Mobilidade reduzida', active: mobilidade },
    { label: 'Acamado', active: acamado },
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
          {tags.map((t) => (
            <RelatorioTag key={t.label} label={t.label} active={t.active} />
          ))}
        </div>
        {semDados && (
          <p className="mt-2.5 text-xs text-muted-foreground leading-relaxed">Sem dados de vistoria</p>
        )}
        {!semDados && !algum && (
          <p className="mt-2.5 text-xs text-muted-foreground leading-relaxed">Nenhum grupo vulnerável identificado na vistoria.</p>
        )}
      </CardContent>
    </Card>
  );
}

const SINTOMAS_RELATORIO: Array<{
  kind: 'field';
  key: keyof Pick<SintomaRow, 'febre' | 'manchasVermelhas' | 'dorArticulacoes' | 'dorCabeca' | 'nausea'>;
  label: string;
  warn?: boolean;
  dot?: boolean;
}> = [
  { kind: 'field', key: 'febre', label: 'Febre', dot: true },
  { kind: 'field', key: 'dorArticulacoes', label: 'Dor no corpo' },
  { kind: 'field', key: 'manchasVermelhas', label: 'Manchas', warn: true },
  { kind: 'field', key: 'nausea', label: 'Náusea' },
  { kind: 'field', key: 'dorCabeca', label: 'Dor de cabeça' },
];

function SintomasRelatorioCard({ sintoma }: { sintoma: SintomaRow | null }) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center gap-2">
          <HeartPulse className="h-4 w-4 text-blue-600 stroke-[1.75]" aria-hidden />
          <CardTitle className="text-sm font-semibold text-blue-600">Sintomas informados</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="flex flex-wrap gap-2">
          {SINTOMAS_RELATORIO.map((item) => {
            const active = sintoma ? !!sintoma[item.key] : false;
            const warn = !!item.warn;
            return (
              <RelatorioTag
                key={item.label}
                label={item.label}
                active={active}
                tone={warn ? 'warning' : 'success'}
                leadingDot={!!item.dot && active && !warn}
              />
            );
          })}
        </div>
        {!sintoma && (
          <p className="mt-2.5 text-xs text-muted-foreground leading-relaxed">Sem registro de sintomas na vistoria.</p>
        )}
        {sintoma && sintoma.moradoresSintomasQtd > 0 && (
          <p className="mt-2 text-[10px] text-muted-foreground">{sintoma.moradoresSintomasQtd} morador(es) com sintomas</p>
        )}
      </CardContent>
    </Card>
  );
}

function DepositosCard({ depositos }: { depositos: Deposito[] }) {
  const byTipo = Object.fromEntries(
    DEPOSITO_TIPOS.map((t) => [t, depositos.find((d) => d.tipo === t) ?? null]),
  );
  const max = Math.max(1, ...depositos.map((d) => d.qtdInspecionados));

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center gap-2">
          <Droplets className="h-4 w-4 text-blue-600 stroke-[1.75]" aria-hidden />
          <CardTitle className="text-sm font-semibold text-blue-600">Depósitos PNCD</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
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
                <span
                  className={cn(
                    'text-[10px] font-semibold tabular-nums',
                    hasFoco ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground',
                  )}
                >
                  {tipo}
                </span>
                <div className="flex h-16 w-full flex-col justify-end rounded-md border border-border/70 bg-muted/50 p-0.5 dark:bg-muted/30">
                  {total > 0 ? (
                    <div
                      className={cn(
                        'w-full rounded-sm transition-colors',
                        hasFoco ? 'bg-orange-400 dark:bg-orange-500' : 'bg-emerald-500 dark:bg-emerald-600',
                      )}
                      style={{ height: `${fillPct}%` }}
                    />
                  ) : (
                    <div className="mx-auto h-1 w-3/4 rounded-full bg-muted-foreground/15" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-sm bg-orange-400" aria-hidden />
            Com foco
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500" aria-hidden />
            Sem foco
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Calhas / tratamento / fatores (relatório) ─────────────────────────────────

const CALHA_ORDER = ['danificada', 'com_agua_parada', 'entupida', 'com_folhas', 'limpa'];
const CALHA_LABEL: Record<string, string> = {
  limpa: 'Limpa', entupida: 'Entupida', com_folhas: 'Com folhas',
  danificada: 'Danificada', com_agua_parada: 'Com água parada',
};
/** Rótulo exibido no relatório (ex.: entupida → Obstruída, alinhado ao painel). */
const CALHA_LABEL_RELATORIO: Record<string, string> = {
  ...CALHA_LABEL,
  entupida: 'Obstruída',
};
const CALHA_COLOR: Record<string, string> = {
  limpa: 'text-green-600', entupida: 'text-orange-500',
  com_folhas: 'text-yellow-600', danificada: 'text-red-500', com_agua_parada: 'text-red-500',
};

type CalhaRow = NonNullable<FocoDetalhes['vistoria']>['calhas'][0];

function nivelRiscoCalha(pior: CalhaRow | null, algumaComFoco: boolean): 'alto' | 'medio' | 'baixo' {
  if (!pior) return 'baixo';
  const grave = ['danificada', 'com_agua_parada', 'entupida'];
  if (algumaComFoco || grave.includes(pior.condicao)) return 'alto';
  if (pior.condicao === 'com_folhas') return 'medio';
  return 'baixo';
}

function RiscoCalhaPill({ nivel }: { nivel: 'alto' | 'medio' | 'baixo' }) {
  const label = nivel === 'alto' ? 'Alto' : nivel === 'medio' ? 'Médio' : 'Baixo';
  if (nivel === 'baixo') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/90 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-100">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
        {label}
      </span>
    );
  }
  if (nivel === 'medio') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/90 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-100">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200/90 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-800 dark:border-orange-800/50 dark:bg-orange-950/40 dark:text-orange-200">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" aria-hidden />
      {label}
    </span>
  );
}

function CalhasRelatorioCard({
  piorCalha,
  calhas,
  imovel,
}: {
  piorCalha: CalhaRow | null;
  calhas: CalhaRow[];
  imovel: FocoDetalhes['imovel'];
}) {
  const comFocoAlgum = calhas.some((c) => c.comFoco);
  const nivel = nivelRiscoCalha(piorCalha, comFocoAlgum);
  const condicaoLabel = piorCalha
    ? (CALHA_LABEL_RELATORIO[piorCalha.condicao] ?? CALHA_LABEL[piorCalha.condicao] ?? piorCalha.condicao)
    : null;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center gap-2">
          <Waves className="h-4 w-4 text-blue-600 stroke-[1.75]" aria-hidden />
          <CardTitle className="text-sm font-semibold text-blue-600">Calhas</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {piorCalha ? (
          <>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground">Condição da calha</p>
              <p className={cn('text-lg font-bold leading-tight mt-0.5', CALHA_COLOR[piorCalha.condicao] ?? 'text-foreground')}>
                {condicaoLabel}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-muted-foreground mb-1.5">Risco</p>
              <RiscoCalhaPill nivel={nivel} />
            </div>
            {comFocoAlgum && (
              <Badge variant="outline" className="text-[10px] border-orange-200 text-orange-800 bg-orange-50/80">
                Com foco ativo na calha
              </Badge>
            )}
            {imovel && (
              <div className="pt-0.5 border-t border-border/50">
                <p className="text-[10px] text-muted-foreground">Acessível</p>
                <p className="text-xs font-semibold text-foreground">{imovel.calhaAcessivel ? 'Sim' : 'Não'}</p>
              </div>
            )}
          </>
        ) : imovel?.temCalha ? (
          <p className="text-xs text-muted-foreground leading-relaxed">Calha presente no imóvel — sem registro detalhado na vistoria.</p>
        ) : (
          <p className="text-xs text-muted-foreground leading-relaxed">Sem calha registrada.</p>
        )}
      </CardContent>
    </Card>
  );
}

function diasEntre(fromIso: string, toDate: Date): number {
  const a = new Date(fromIso).setHours(0, 0, 0, 0);
  const b = new Date(toDate).setHours(0, 0, 0, 0);
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

function TratamentoRelatorioCard({
  vistoria,
  depositos,
  calhas,
  focoInspecaoEm,
}: {
  vistoria: NonNullable<FocoDetalhes['vistoria']> | null;
  depositos: NonNullable<FocoDetalhes['vistoria']>['depositos'];
  calhas: CalhaRow[];
  focoInspecaoEm: string | null;
}) {
  const larvicida = depositos.some((d) => d.usouLarvicida);
  const eliminacao = depositos.some((d) => d.eliminado);
  const tratCalha = calhas.some((c) => c.tratamentoRealizado);

  const tipoTratativa = larvicida
    ? 'Larvicida'
    : eliminacao
      ? 'Eliminação / retirada'
      : tratCalha
        ? 'Tratamento na calha'
        : vistoria?.tipoAtividade
          ? vistoria.tipoAtividade.replace(/_/g, ' ')
          : '—';

  const fotos = calhas.map((c) => c.fotoUrl).filter((u): u is string => !!u);
  const urlAntes = fotos[0];
  const urlDepois = fotos[1] ?? fotos[0];
  const evidenciasQtd = fotos.length;

  let retornoDate: Date | null = null;
  let diasLabel = '';
  if (focoInspecaoEm) {
    retornoDate = new Date(focoInspecaoEm);
    if (vistoria?.dataVisita) {
      const n = diasEntre(vistoria.dataVisita, retornoDate);
      if (n >= 0) diasLabel = ` (${n} dias)`;
    }
  } else if (vistoria?.dataVisita) {
    retornoDate = new Date(vistoria.dataVisita);
    retornoDate.setDate(retornoDate.getDate() + 7);
    diasLabel = ' (7 dias)';
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-blue-600 stroke-[1.75]" aria-hidden />
          <CardTitle className="text-sm font-semibold text-blue-600">Tratamento</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {!vistoria ? (
          <p className="text-xs text-muted-foreground">Sem vistoria registrada.</p>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2.5 flex-1">
              <div>
                <p className="text-[10px] font-medium text-muted-foreground">Tipo de tratativa</p>
                <p className="text-sm font-bold text-foreground capitalize mt-0.5">{tipoTratativa}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-muted-foreground">Retorno programado</p>
                <p className="text-sm font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                  {retornoDate ? `${formatDate(retornoDate.toISOString())}${diasLabel}` : '—'}
                </p>
              </div>
              {vistoria.agente?.nome && (
                <p className="text-[10px] text-muted-foreground">
                  Agente: <span className="font-semibold text-foreground">{vistoria.agente.nome}</span>
                </p>
              )}
              {!vistoria.acessoRealizado && (
                <div className="pt-1 border-t border-border/50">
                  <p className="text-[10px] font-medium text-muted-foreground">Acesso</p>
                  <p className="text-xs font-semibold text-orange-600 mt-0.5">
                    Sem acesso{vistoria.motivoSemAcesso ? ` — ${vistoria.motivoSemAcesso}` : ''}
                  </p>
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-end gap-2 sm:pt-0">
              <div className="flex gap-2">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[9px] font-medium text-muted-foreground">Antes</span>
                  <div className="h-14 w-14 overflow-hidden rounded-md border border-border/80 bg-muted/40">
                    {urlAntes ? (
                      <img src={urlAntes} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[9px] text-muted-foreground">—</div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[9px] font-medium text-muted-foreground">Depois</span>
                  <div className="h-14 w-14 overflow-hidden rounded-md border border-border/80 bg-muted/40">
                    {urlDepois ? (
                      <img src={urlDepois} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[9px] text-muted-foreground">—</div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex h-[72px] w-12 flex-col items-center justify-center rounded-md border border-border/80 bg-muted/30 px-1">
                <span className="text-[9px] font-medium text-muted-foreground text-center leading-tight">Evidências</span>
                <span className="text-lg font-bold text-foreground tabular-nums leading-none mt-1">{evidenciasQtd}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FatorRelatorioRow({
  label,
  active,
  Icon,
  dot,
}: {
  label: string;
  active: boolean;
  Icon: LucideIcon;
  dot: 'red' | 'orange' | 'muted';
}) {
  const dotClass =
    dot === 'red'
      ? 'bg-red-500 shadow-[0_0_0_2px_rgba(239,68,68,0.25)]'
      : dot === 'orange'
        ? 'bg-orange-500 shadow-[0_0_0_2px_rgba(249,115,22,0.2)]'
        : 'bg-muted-foreground/25';
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" aria-hidden />
      <span className={cn('text-[11px] font-medium truncate flex-1', active ? 'text-foreground' : 'text-muted-foreground')}>
        {label}
      </span>
      <span className={cn('h-2 w-2 shrink-0 rounded-full', active ? dotClass : 'bg-muted-foreground/20')} aria-hidden />
    </div>
  );
}

function FatoresRiscoRelatorioCard({
  risco,
  imovel,
  piorCalha,
  vistoria,
}: {
  risco: RiscoVistoriaRow | null;
  imovel: FocoDetalhes['imovel'];
  piorCalha: CalhaRow | null;
  vistoria: NonNullable<FocoDetalhes['vistoria']> | null;
}) {
  const aguaParada = !!(risco?.acumuloMaterialOrganico || piorCalha?.condicao === 'com_agua_parada');
  const terrenoBaldio = !!(risco?.riscoMoradia || risco?.criadouroAnimais);
  const posChuva = !!(
    vistoria?.tipoAtividade?.toLowerCase().includes('chuva')
    || vistoria?.consolidacaoResumo?.toLowerCase().includes('chuva')
  );

  const fatores: Array<{
    label: string;
    active: boolean;
    Icon: LucideIcon;
    dot: 'red' | 'orange' | 'muted';
  }> = [
    { label: 'Lixo acumulado', active: !!risco?.lixo, Icon: Trash2, dot: 'orange' },
    { label: 'Água parada', active: aguaParada, Icon: Droplets, dot: 'orange' },
    { label: 'Terreno baldio', active: terrenoBaldio, Icon: TreeDeciduous, dot: 'red' },
    { label: 'Recorrência', active: !!imovel?.historicoRecusa, Icon: RefreshCw, dot: 'orange' },
    { label: 'Pós-chuva', active: posChuva, Icon: CloudRain, dot: 'orange' },
  ];

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-blue-600 stroke-[1.75]" aria-hidden />
          <CardTitle className="text-sm font-semibold text-blue-600">Fatores de risco</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {risco || imovel ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            {fatores.map((f) => (
              <FatorRelatorioRow key={f.label} label={f.label} active={f.active} Icon={f.Icon} dot={f.dot} />
            ))}
            {risco?.outroRiscoVetorial && (
              <div className="col-span-2 pt-1 border-t border-border/50">
                <p className="text-[10px] text-muted-foreground">Outro risco vetorial</p>
                <p className="text-[11px] font-semibold text-foreground">{risco.outroRiscoVetorial}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Sem dados de vistoria.</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function istiClassificacao(score: number): { label: string; badgeClass: string } {
  if (score >= 80) return { label: 'Muito alto', badgeClass: 'bg-red-600 text-white shadow-sm' };
  if (score >= 60) return { label: 'Alto', badgeClass: 'bg-red-600 text-white shadow-sm' };
  if (score >= 40) return { label: 'Médio', badgeClass: 'bg-amber-500 text-white shadow-sm' };
  if (score >= 20) return { label: 'Baixo', badgeClass: 'bg-sky-600 text-white shadow-sm' };
  return { label: 'Muito baixo', badgeClass: 'bg-emerald-600 text-white shadow-sm' };
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDatetime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

type RiscoKey = keyof Pick<NonNullable<NonNullable<FocoDetalhes['vistoria']>['riscos'][0]>,
  'lixo' | 'caixaDestampada' | 'criadouroAnimais' | 'residuosOrganicos' | 'residuosQuimicos' |
  'residuosMedicos' | 'acumuloMaterialOrganico' | 'animaisSinaisLv' | 'menorIncapaz' |
  'idosoIncapaz' | 'depQuimico' | 'riscoAlimentar' | 'riscoMoradia'
>;

const RISCO_LABELS: Array<{ key: RiscoKey; label: string }> = [
  { key: 'lixo', label: 'Lixo acumulado' },
  { key: 'caixaDestampada', label: 'Caixa destampada' },
  { key: 'criadouroAnimais', label: 'Criadouro animais' },
  { key: 'residuosOrganicos', label: 'Resíduos orgânicos' },
  { key: 'residuosQuimicos', label: 'Resíduos químicos' },
  { key: 'residuosMedicos', label: 'Resíduos médicos' },
  { key: 'acumuloMaterialOrganico', label: 'Acúmulo orgânico' },
  { key: 'animaisSinaisLv', label: 'Animais c/ sinais LV' },
];

const SINTOMA_LABELS = [
  { key: 'febre', label: 'Febre' },
  { key: 'manchasVermelhas', label: 'Manchas vermelhas' },
  { key: 'dorArticulacoes', label: 'Dor articulações' },
  { key: 'dorCabeca', label: 'Dor de cabeça' },
] as const;

// ── Mapa Leaflet (client-only: evita SSR e mostra tiles OSM + marcador) ───────

function MapaSimples({ lat, lng, className }: { lat: number; lng: number; className?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const center: [number, number] = [lat, lng];

  if (!mounted) {
    return (
      <div
        className={cn(
          'relative flex min-h-[200px] items-center justify-center overflow-hidden rounded-xl border border-border/60 bg-muted',
          className,
        )}
      >
        <span className="text-xs text-muted-foreground">Carregando mapa…</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative isolate z-0 min-h-[200px] overflow-hidden rounded-xl border border-border/60 bg-muted [&_.leaflet-container]:font-sans',
        className,
      )}
    >
      <MapContainer
        key={`${lat},${lng}`}
        center={center}
        zoom={16}
        className="z-0 h-full w-full min-h-[200px]"
        style={{ height: '100%', width: '100%', minHeight: 200 }}
        scrollWheelZoom
        zoomControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <CircleMarker
          center={center}
          radius={11}
          pathOptions={{
            color: '#b91c1c',
            fillColor: '#ef4444',
            fillOpacity: 0.9,
            weight: 2,
          }}
        >
          <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
            <span className="font-mono text-[11px]">
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </span>
          </Tooltip>
        </CircleMarker>
      </MapContainer>
    </div>
  );
}

type ResumoTileVariant = 'green' | 'blue' | 'orange';

const RESUMO_TILE_STYLES: Record<ResumoTileVariant, string> = {
  green:
    'border-emerald-200/80 bg-emerald-50 text-emerald-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:border-emerald-800/50 dark:bg-emerald-950/35 dark:text-emerald-200',
  blue:
    'border-sky-200/80 bg-sky-50 text-sky-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:border-sky-800/50 dark:bg-sky-950/35 dark:text-sky-200',
  orange:
    'border-orange-200/80 bg-orange-50 text-orange-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:border-orange-800/50 dark:bg-orange-950/35 dark:text-orange-200',
};

function ResumoEstrategicoTile({
  value,
  label,
  variant,
}: {
  value: string | number;
  label: string;
  variant: ResumoTileVariant;
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-1 flex-col items-center justify-center rounded-lg border px-1.5 py-3 text-center',
        RESUMO_TILE_STYLES[variant],
      )}
    >
      <p className="text-xl font-bold tabular-nums leading-none tracking-tight sm:text-2xl">{value}</p>
      <p className="mt-2 max-w-[7.5rem] text-[10px] font-medium leading-tight text-foreground/80 dark:text-foreground/75">
        {label}
      </p>
    </div>
  );
}

function LegendaRiscoRelatorio({ className }: { className?: string }) {
  const itens = [
    { cor: 'bg-red-500', label: 'Muito alto' },
    { cor: 'bg-orange-500', label: 'Alto' },
    { cor: 'bg-amber-400', label: 'Médio' },
    { cor: 'bg-emerald-500', label: 'Baixo' },
  ];
  return (
    <div className={cn('flex flex-col', className)}>
      <div className="rounded-lg border border-border/80 bg-background p-3 shadow-sm">
        <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Legenda de risco</p>
        <ul className="space-y-2">
          {itens.map((it) => (
            <li key={it.label} className="flex items-center gap-2">
              <span className={cn('h-2 w-2 shrink-0 rounded-full', it.cor)} aria-hidden />
              <span className="text-[11px] font-medium text-foreground">{it.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function equipeFromPayload(payload: Record<string, unknown> | null | undefined): string | null {
  if (!payload || typeof payload !== 'object') return null;
  for (const k of ['equipeNome', 'equipe_nome', 'equipe'] as const) {
    const v = payload[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function TabCountBadge({ count }: { count: number }) {
  if (count < 1) return null;
  return (
    <span className="ml-1 inline-flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-muted px-1 text-[10px] font-semibold tabular-nums text-muted-foreground">
      {count > 99 ? '99+' : count}
    </span>
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
  const { clienteId } = useClienteAtivo();
  const { data, isLoading } = useFocoDetalhes(id);
  const { data: focoBundle } = useFocoRisco(id);
  const origemItemId = focoBundle?.foco?.origem_levantamento_item_id ?? null;
  const { operacoes: opQuery, deteccao: detQuery } = useEvidenciasFoco(id, clienteId, origemItemId);
  const { data: timelineItems = [] } = useFocoRiscoTimeline(id);

  if (isLoading) return <PageSkeleton />;
  if (!data) return null;

  const { foco, imovel, vistoria, casosCount } = data;

  // Derived values
  const sintoma = vistoria?.sintomas?.[0] ?? null;
  const risco = vistoria?.riscos?.[0] ?? null;
  const depositos = vistoria?.depositos ?? [];
  const calhas = vistoria?.calhas ?? [];

  const evidenciasFocoCount =
    calhas.filter((c) => !!c.fotoUrl).length
    + (detQuery.data?.length ?? 0)
    + (opQuery.data ?? []).reduce(
      (n, op: { evidencias?: Array<unknown> }) => n + (op.evidencias?.length ?? 0),
      0,
    );
  const historicoFocoCount = timelineItems.length;
  const equipeNome = equipeFromPayload(vistoria?.payload ?? null);

  const piorCalha = calhas.length > 0
    ? calhas.reduce((worst, c) => {
        const wi = CALHA_ORDER.indexOf(worst.condicao);
        const ci = CALHA_ORDER.indexOf(c.condicao);
        return ci < wi ? c : worst;
      }, calhas[0])
    : null;

  const gruposCount =
    Number(!!(vistoria?.idosos || risco?.idosoIncapaz))
    + Number(!!(vistoria?.criancas7anos || risco?.menorIncapaz))
    + Number(!!vistoria?.gravidas);
  const sintomasCount = SINTOMA_LABELS.filter((s) => sintoma?.[s.key] === true).length;

  const depositoPredominante = depositos.reduce<{ tipo: string; qtd: number } | null>((best, d) => {
    if (!best || d.qtdComFocos > best.qtd) return { tipo: d.tipo, qtd: d.qtdComFocos };
    return best;
  }, null);

  const isti = foco.scorePrioridade;
  const istiInfo = istiClassificacao(isti);

  const retornoProgramadoValor = (() => {
    if (foco.inspecaoEm && vistoria?.dataVisita) {
      const n = diasEntre(vistoria.dataVisita, new Date(foco.inspecaoEm));
      if (n >= 0) return `${n} dias`;
    }
    if (vistoria?.dataVisita) return '7 dias';
    return '—';
  })();

  const lat = foco.latitude ?? imovel?.latitude ?? null;
  const lng = foco.longitude ?? imovel?.longitude ?? null;

  const enderecoDisplay = (() => {
    if (imovel?.logradouro) {
      const parts = [imovel.logradouro, imovel.numero, imovel.bairro].filter(Boolean);
      return parts.join(', ');
    }
    return foco.enderecoNormalizado ?? 'Endereço não informado';
  })();

  const statusKey = foco.status as FocoRiscoStatus;
  const statusHex = COR_STATUS[statusKey] ?? '#BA7517';
  const statusLabel = LABEL_STATUS[statusKey] ?? foco.status;
  const classificacao = foco.classificacaoInicial as FocoRiscoClassificacao | undefined;
  const focoLabel = classificacao ? LABEL_CLASSIFICACAO_INICIAL[classificacao] ?? classificacao : '—';
  const codigoStr = foco.codigoFoco ?? foco.id.slice(0, 8).toUpperCase();
  const mostrarEncaminhar = foco.status === 'em_triagem' || foco.status === 'aguarda_inspecao';

  return (
    <div className="max-w-7xl mx-auto px-4 pt-2 pb-10 space-y-3">

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar
        </Button>
      </div>

      {/* ── Card ocorrência + stepper (visual alinhado ao painel de ocorrência) ─ */}
      <Card className="border-border/80 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="p-5 sm:p-6 space-y-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-1">
                <p className="text-[11px] text-muted-foreground font-medium tracking-wide">Ocorrência</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl sm:text-[1.65rem] font-bold font-mono text-foreground tracking-tight">
                    {codigoStr}
                  </h1>
                  <button
                    type="button"
                    title="Copiar código"
                    onClick={() => {
                      navigator.clipboard.writeText(codigoStr);
                      toast.success('Código copiado');
                    }}
                    className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {mostrarEncaminhar && (
                  <Button
                    className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm gap-2 px-4"
                    onClick={() => navigate(`/gestor/focos/${id}`)}
                  >
                    {foco.status === 'em_triagem' ? 'Encaminhar para inspeção' : 'Re-atribuir agente'}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="shrink-0 rounded-lg border-border/80">
                      <MoreVertical className="w-4 h-4 text-muted-foreground" />
                      <span className="sr-only">Menu de ações</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => navigate(`/gestor/focos/${id}`)}>
                      Abrir detalhe do foco
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/gestor/focos/${id}/relatorio`);
                        toast.success('Link copiado');
                      }}
                    >
                      Copiar link do relatório
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/gestor/focos')}>
                      Voltar à lista de focos
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-4 pt-1 border-t border-border/60">
              <div className="space-y-1.5">
                <p className="text-[11px] text-muted-foreground font-medium">Prioridade</p>
                <div>
                  {foco.prioridade ? (
                    <PrioridadeBadge prioridade={foco.prioridade as any} className="rounded-md px-2.5 py-0.5 text-xs font-bold" />
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] text-muted-foreground font-medium">Status atual</p>
                <div className="flex items-center gap-2 min-h-[28px]">
                  <span className="w-2 h-2 rounded-full shrink-0 ring-2 ring-white shadow" style={{ backgroundColor: statusHex }} />
                  <span className="text-sm font-semibold" style={{ color: statusHex }}>
                    {statusLabel}
                  </span>
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] text-muted-foreground font-medium">Foco</p>
                <p className="text-sm font-semibold text-red-600 dark:text-red-400 leading-snug">{focoLabel}</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-[11px] text-muted-foreground font-medium">Origem</p>
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {origemIcon(foco.origemTipo)}
                  <span>{LABEL_ORIGEM[foco.origemTipo] ?? foco.origemTipo}</span>
                </div>
              </div>
              <div className="space-y-1.5 col-span-2 lg:col-span-1">
                <p className="text-[11px] text-muted-foreground font-medium">Endereço</p>
                <div className="flex items-start gap-2 text-sm text-foreground/90">
                  <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="leading-snug">{enderecoDisplay}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border/60 bg-muted/20 px-3 sm:px-5 py-4">
            <RelatorioStatusStepper currentStatus={foco.status} />
          </div>
        </CardContent>
      </Card>

      {/* ── Cards row 1 ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

        <MoradoresRelatorioCard vistoria={vistoria} />

        <GruposVulneraveisRelatorioCard risco={risco} vistoria={vistoria} />
        <SintomasRelatorioCard sintoma={sintoma} />
        <DepositosCard depositos={depositos} />
      </div>

      {/* ── Cards row 2 ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

        <CalhasRelatorioCard piorCalha={piorCalha} calhas={calhas} imovel={imovel} />
        <TratamentoRelatorioCard
          vistoria={vistoria}
          depositos={depositos}
          calhas={calhas}
          focoInspecaoEm={foco.inspecaoEm}
        />
        <FatoresRiscoRelatorioCard risco={risco} imovel={imovel} piorCalha={piorCalha} vistoria={vistoria} />

        {/* ISTI */}
        <Card className="border-border/60 shadow-sm overflow-hidden">
          <CardHeader className="pb-0 pt-4 px-4">
            <CardTitle className="text-sm font-semibold leading-snug text-foreground tracking-tight">
              Índice Sanitário Territorial do Imóvel (ISTI)
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col px-4 pb-4 pt-1">
            <IstiGauge score={isti} />
            <div className="mt-1 flex items-center justify-between gap-3 border-t border-border/50 pt-3">
              <span className="text-xs text-muted-foreground">Classificação</span>
              <span className={cn('inline-flex shrink-0 rounded-md px-2.5 py-1 text-xs font-bold', istiInfo.badgeClass)}>
                {istiInfo.label}
              </span>
            </div>
            <button
              type="button"
              className="mt-3 inline-flex items-center justify-center gap-1.5 self-center text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              onClick={() =>
                toast.info('ISTI — Índice Sanitário Territorial do Imóvel', {
                  description:
                    'Pontuação de 0 a 100 que resume o contexto sanitário e operacional do imóvel para priorização. Valores mais altos indicam maior urgência de acompanhamento pela vigilância.',
                  duration: 9000,
                })
              }
            >
              Entenda o ISTI
              <Info className="h-4 w-4 shrink-0" aria-hidden />
            </button>
            {vistoria?.riscoVetorial && (
              <p className="mt-2 text-center text-[10px] text-muted-foreground">
                Risco vetorial:{' '}
                <span className="font-semibold capitalize text-foreground">{vistoria.riscoVetorial}</span>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Resumo estratégico + Localização ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

        {/* Resumo estratégico */}
        <Card className="border-border/60">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-foreground">Resumo estratégico</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:gap-2">
              <ResumoEstrategicoTile
                value={vistoria?.moradoresQtd ?? '—'}
                label="Moradores expostos"
                variant="green"
              />
              <ResumoEstrategicoTile value={gruposCount || '—'} label="Grupos vulneráveis" variant="blue" />
              <ResumoEstrategicoTile value={sintomasCount || '—'} label="Sintoma informado" variant="blue" />
              <ResumoEstrategicoTile
                value={depositoPredominante?.tipo ?? '—'}
                label="Depósito predominante"
                variant="orange"
              />
              <ResumoEstrategicoTile value={retornoProgramadoValor} label="Retorno programado" variant="blue" />
            </div>

            {/* Dimensões da consolidação */}
            {vistoria && (vistoria.riscoVetorial || vistoria.riscoSocioambiental || vistoria.vulnerabilidadeDomiciliar || vistoria.alertaSaude || vistoria.dimensaoDominante || vistoria.prioridadeMotivo) && (
              <div className="mt-4 pt-3 border-t border-border/60 grid grid-cols-2 gap-2">
                {[
                  { label: 'Risco vetorial', val: vistoria.riscoVetorial },
                  { label: 'Risco socioambiental', val: vistoria.riscoSocioambiental },
                  { label: 'Vulnerab. domiciliar', val: vistoria.vulnerabilidadeDomiciliar },
                  { label: 'Alerta saúde', val: vistoria.alertaSaude },
                  { label: 'Dimensão dominante', val: vistoria.dimensaoDominante },
                  { label: 'Motivo da prioridade', val: vistoria.prioridadeMotivo },
                ].filter((d) => d.val).map((d) => (
                  <div key={d.label}>
                    <p className="text-[10px] text-muted-foreground">{d.label}</p>
                    <p className="text-xs font-semibold capitalize">{d.val}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Localização */}
        <Card className="border-border/60">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm font-semibold text-foreground">Localização do imóvel</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {vistoria?.fotoExternaUrl && (
              <div className="mb-3 overflow-hidden rounded-lg border border-border/60">
                <img src={vistoria.fotoExternaUrl} alt="Foto da fachada" className="w-full max-h-40 object-cover" />
                <p className="px-2 py-1 text-[10px] text-muted-foreground bg-muted/40">Foto da fachada</p>
              </div>
            )}
            {lat && lng ? (
              <div className="rounded-xl border border-border/60 bg-muted/50 p-3 dark:bg-muted/30">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
                  <div className="min-h-[200px] min-w-0 flex-1">
                    <MapaSimples lat={lat} lng={lng} className="h-full min-h-[200px]" />
                  </div>
                  <LegendaRiscoRelatorio className="w-full shrink-0 lg:w-[148px]" />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/50 py-10">
                <MapPin className="mb-1 h-6 w-6 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Coordenadas não disponíveis</p>
              </div>
            )}
            {imovel && (
              <div className="mt-3 flex flex-wrap gap-4 text-xs">
                <div>
                  <p className="text-[10px] text-muted-foreground">Tipo de imóvel</p>
                  <p className="font-medium capitalize">{imovel.tipoImovel}</p>
                </div>
                {imovel.bairro && (
                  <div>
                    <p className="text-[10px] text-muted-foreground">Bairro</p>
                    <p className="font-medium">{imovel.bairro}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Tabs (Resumo · Evidências · Histórico · Vulnerabilidade) ───────── */}
      <Tabs defaultValue="resumo" className="mt-2">
        <TabsList className="inline-flex h-auto w-full min-h-10 flex-wrap gap-0 rounded-none border-b border-border/60 bg-transparent p-0 text-muted-foreground">
          <TabsTrigger
            value="resumo"
            className="rounded-none border-b-2 border-transparent px-3 py-2 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary"
          >
            Resumo
          </TabsTrigger>
          <TabsTrigger
            value="evidencias"
            className="rounded-none border-b-2 border-transparent px-3 py-2 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary"
          >
            Evidências
            <TabCountBadge count={evidenciasFocoCount} />
          </TabsTrigger>
          <TabsTrigger
            value="historico"
            className="rounded-none border-b-2 border-transparent px-3 py-2 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary"
          >
            Histórico
            <TabCountBadge count={historicoFocoCount} />
          </TabsTrigger>
          <TabsTrigger
            value="vulnerabilidade"
            className="rounded-none border-b-2 border-transparent px-3 py-2 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary"
          >
            Vulnerabilidade
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="mt-4">
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
            </div>
            <div className="space-y-3 md:border-r md:border-border/50 md:pr-4">
              <h3 className="font-semibold text-xs uppercase text-muted-foreground tracking-wide">Responsável</h3>
              <InfoRow label="Agente responsável" value={foco.responsavel?.nome ?? '—'} />
              <InfoRow label="Equipe" value={equipeNome ?? '—'} />
              <InfoRow label="E-mail" value={foco.responsavel?.email ?? '—'} />
              {vistoria?.agente?.nome && <InfoRow label="Agente vistoria" value={vistoria.agente.nome ?? '—'} />}
            </div>
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-xs uppercase text-muted-foreground tracking-wide">Observações</h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 -mr-1 text-muted-foreground hover:text-foreground"
                  title="Editar no detalhe do foco"
                  onClick={() => navigate(`/gestor/focos/${id}`)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {foco.observacao ?? foco.desfecho ?? 'Nenhuma observação registrada'}
              </p>
              {vistoria?.consolidacaoResumo && (
                <>
                  <h3 className="font-semibold text-xs uppercase text-muted-foreground tracking-wide pt-2">Consolidação</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{vistoria.consolidacaoResumo}</p>
                </>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="evidencias" className="mt-4 space-y-4">
          {origemItemId && (
            <Card className="border-border/60">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Image className="w-4 h-4" aria-hidden />
                  Detecção original
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {detQuery.isLoading ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Skeleton className="h-24 rounded-lg" />
                    <Skeleton className="h-24 rounded-lg" />
                  </div>
                ) : detQuery.data?.length ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {detQuery.data.map((ev: { id: string; image_url: string; legenda?: string }) => (
                      <div key={ev.id} className="relative rounded-lg overflow-hidden border border-border/60">
                        <img src={ev.image_url} alt={ev.legenda ?? 'Evidência'} className="w-full h-28 object-cover" />
                        {ev.legenda && (
                          <p className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1.5 py-0.5 truncate">
                            {ev.legenda}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-2">Sem imagens da detecção original.</p>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="border-border/60">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Wrench className="w-4 h-4" aria-hidden />
                Operações de campo e fotos de calhas
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4">
              {opQuery.isLoading ? (
                <Skeleton className="h-20 w-full rounded-lg" />
              ) : opQuery.data?.length ? (
                opQuery.data.map((op: {
                  id: string;
                  status: string;
                  observacao?: string;
                  concluido_em?: string;
                  evidencias?: Array<{ id: string; image_url: string; legenda?: string }>;
                }) => (
                  <div key={op.id} className="space-y-2 border-b border-border/40 pb-3 last:border-0">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold capitalize">{op.status}</span>
                      {op.concluido_em && (
                        <span className="text-muted-foreground">{new Date(op.concluido_em).toLocaleString('pt-BR')}</span>
                      )}
                    </div>
                    {op.observacao && <p className="text-xs text-muted-foreground">{op.observacao}</p>}
                    {op.evidencias?.length ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {op.evidencias.map((ev) => (
                          <div key={ev.id} className="relative rounded overflow-hidden border border-border/60">
                            <img src={ev.image_url} alt={ev.legenda ?? 'Evidência'} className="w-full h-24 object-cover" />
                            {ev.legenda && (
                              <p className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1 py-0.5 truncate">
                                {ev.legenda}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-1">Nenhuma operação com evidências.</p>
              )}

              {calhas.some((c) => c.fotoUrl) && (
                <div className="pt-2 border-t border-border/50">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Calhas (vistoria)</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {calhas.filter((c) => c.fotoUrl).map((c) => (
                      <div key={c.id} className="rounded-lg overflow-hidden border border-border/60">
                        <img src={c.fotoUrl!} alt={c.posicao ?? 'Calha'} className="w-full h-24 object-cover" />
                        <p className="text-[10px] px-1.5 py-1 bg-muted/50 truncate">{c.posicao ?? 'Calha'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!origemItemId && !opQuery.data?.length && !calhas.some((c) => c.fotoUrl) && !detQuery.isLoading && !opQuery.isLoading && (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma evidência disponível para este foco.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <FocoRiscoTimeline focoId={id!} />
          <div className="mt-4 flex justify-center">
            <Button variant="outline" size="sm" onClick={() => navigate(`/gestor/focos/${id}`)}>
              Abrir página de detalhe
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="vulnerabilidade" className="mt-4 space-y-6">
          {vistoria && (vistoria.riscoVetorial || vistoria.riscoSocioambiental || vistoria.vulnerabilidadeDomiciliar || vistoria.alertaSaude) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {vistoria.riscoVetorial && (
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide">Risco vetorial</p>
                  <p className="text-sm font-medium capitalize mt-1">{vistoria.riscoVetorial}</p>
                </div>
              )}
              {vistoria.riscoSocioambiental && (
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide">Risco socioambiental</p>
                  <p className="text-sm font-medium capitalize mt-1">{vistoria.riscoSocioambiental}</p>
                </div>
              )}
              {vistoria.vulnerabilidadeDomiciliar && (
                <div className="rounded-lg border border-border/60 p-3 sm:col-span-2">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide">Vulnerabilidade domiciliar</p>
                  <p className="text-sm font-medium capitalize mt-1">{vistoria.vulnerabilidadeDomiciliar}</p>
                </div>
              )}
              {vistoria.alertaSaude && (
                <div className="rounded-lg border border-border/60 p-3 sm:col-span-2">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide">Alerta saúde</p>
                  <p className="text-sm font-medium capitalize mt-1">{vistoria.alertaSaude}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sem dimensões de vulnerabilidade registradas na vistoria.</p>
          )}

          <div>
            <h3 className="font-semibold text-xs uppercase text-muted-foreground tracking-wide mb-3">Dados complementares do imóvel</h3>
            {imovel ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <InfoRow label="Logradouro" value={[imovel.logradouro, imovel.numero, imovel.complemento].filter(Boolean).join(', ') || '—'} />
                <InfoRow label="Bairro" value={imovel.bairro ?? '—'} />
                <InfoRow label="Quarteirão" value={imovel.quarteirao ?? '—'} />
                <InfoRow label="Tipo" value={imovel.tipoImovel} />
                <InfoRow label="Tem calha" value={imovel.temCalha ? 'Sim' : 'Não'} />
                <InfoRow label="Calha acessível" value={imovel.calhaAcessivel ? 'Sim' : 'Não'} />
                <InfoRow label="Proprietário ausente" value={imovel.proprietarioAusente ? 'Sim' : 'Não'} />
                <InfoRow label="Animal agressivo" value={imovel.temAnimalAgressivo ? 'Sim' : 'Não'} />
                <InfoRow label="Histórico de recusa" value={imovel.historicoRecusa ? 'Sim' : 'Não'} />
                {imovel.latitude != null && imovel.longitude != null && (
                  <InfoRow label="Coordenadas" value={`${imovel.latitude.toFixed(5)}, ${imovel.longitude.toFixed(5)}`} />
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum imóvel vinculado a este foco.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-xs font-medium">{value}</p>
    </div>
  );
}
