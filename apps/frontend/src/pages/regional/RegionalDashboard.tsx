/**
 * RegionalDashboard — Dashboard analítico para analista_regional (P5)
 *
 * 4 tabs:
 *   Visão Geral  — KPIs + Score de Saúde + tabela comparativa + rankings
 *   Mapa Visual  — Treemap por município (size=focos, cor=score) + SLA bars
 *   Alertas      — Painel proativo de municípios que precisam de atenção
 *   Insights IA  — Análise narrativa gerada por Claude Haiku sob demanda
 */

import { useMemo, useState, useCallback, Fragment } from 'react';
import {
  Treemap, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  Cell, PieChart, Pie, LineChart, Line, AreaChart, Area,
} from 'recharts';
import { useRegionalComparativo, useRegionalEvolucao, useRegionalKpi, useRegionalMunicipioDetalhe, useRegionalResumo, useRegionalSla, useRegionalUso, useRegionalVulnerabilidade } from '@/hooks/queries/useRegionalData';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { http, tokenStore } from '@sentinella/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Loader2, MapPin, CheckCircle2, AlertTriangle, Activity, TrendingUp,
  Download, FileText, Sparkles, AlertCircle, WifiOff, BarChart3, Map as MapIcon, PieChart as PieIcon, ArrowLeftRight, Search,
} from 'lucide-react';
import type { RegionalComparativoResponse, RegionalEvolucaoItem, RegionalKpiMunicipio, RegionalMunicipioDetalhe, RegionalResumoMunicipio, RegionalSlaMunicipio, RegionalUsoSistema, RegionalVulnerabilidadeMunicipio } from '@/types/database';

// ── Tipos internos ────────────────────────────────────────────────────────────

interface ScoreMunicipio {
  cliente_id: string;
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

type AlertaSeveridade = 'critico' | 'atencao' | 'inativo';
interface Alerta {
  cliente_id: string;
  municipio_nome: string;
  uf: string | null;
  severidade: AlertaSeveridade;
  mensagem: string;
}

// ── Lógica de Score de Saúde (0–100) ─────────────────────────────────────────
//
// Dimensões:
//   Taxa de resolução  40 pts  → resolucao_pct * 0.40
//   SLA compliance     30 pts  → (1 – vencido/ativos) * 30
//   Atividade sistema  20 pts  → min(eventos_7d/20, 1) * 20
//   Velocidade         10 pts  → < 12h=10, < 24h=8, < 72h=5, ≥72h=2, sem dados=5

function calcularScore(
  row: RegionalKpiMunicipio,
  uso?: RegionalUsoSistema,
): number {
  const scoreResolucao = Math.min(row.taxa_resolucao_pct, 100) * 0.40;
  const ativos = Math.max(row.focos_ativos, 1);
  const slaRatio = Math.max(0, 1 - row.sla_vencido_count / ativos);
  const scoreSla = slaRatio * 30;
  const eventos = uso?.eventos_7d ?? 0;
  const scoreUso = Math.min(eventos / 20, 1) * 20;
  const t = row.tempo_medio_resolucao_horas;
  const scoreVelocidade = t == null ? 5 : t < 12 ? 10 : t < 24 ? 8 : t < 72 ? 5 : 2;
  return Math.round(scoreResolucao + scoreSla + scoreUso + scoreVelocidade);
}

function gradeFromScore(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  if (score >= 30) return 'D';
  return 'F';
}

function scoreToColor(score: number): string {
  if (score >= 85) return '#10b981';
  if (score >= 70) return '#84cc16';
  if (score >= 50) return '#f59e0b';
  if (score >= 30) return '#f97316';
  return '#ef4444';
}

// ── Alertas proativos ─────────────────────────────────────────────────────────

function calcularAlertas(
  kpi: RegionalKpiMunicipio[],
  usoMap: Map<string, RegionalUsoSistema>,
): Alerta[] {
  const alertas: Alerta[] = [];

  for (const row of kpi) {
    const u = usoMap.get(row.cliente_id);
    const ativos = row.focos_ativos;
    const slaRatioPct = ativos > 0 ? (row.sla_vencido_count / ativos) * 100 : 0;

    // Crítico: SLA vencido absoluto alto OU proporção > 30%
    if (row.sla_vencido_count > 5 || (ativos > 0 && slaRatioPct >= 30)) {
      alertas.push({
        cliente_id: row.cliente_id,
        municipio_nome: row.municipio_nome,
        uf: row.uf,
        severidade: 'critico',
        mensagem: row.sla_vencido_count > 5
          ? `${row.sla_vencido_count} focos com SLA vencido — intervenção urgente necessária`
          : `${slaRatioPct.toFixed(0)}% dos focos ativos com SLA vencido`,
      });
      continue;
    }

    // Atenção: baixa taxa de resolução com volume relevante
    if (row.taxa_resolucao_pct < 25 && row.total_focos > 3) {
      alertas.push({
        cliente_id: row.cliente_id,
        municipio_nome: row.municipio_nome,
        uf: row.uf,
        severidade: 'atencao',
        mensagem: `Taxa de resolução baixa: ${row.taxa_resolucao_pct.toFixed(1)}% com ${row.total_focos} focos registrados`,
      });
      continue;
    }

    // Inativo: sem atividade nos últimos 7 dias com focos pendentes
    if ((u?.eventos_7d ?? 0) === 0 && ativos > 0) {
      alertas.push({
        cliente_id: row.cliente_id,
        municipio_nome: row.municipio_nome,
        uf: row.uf,
        severidade: 'inativo',
        mensagem: `Sem atividade nos últimos 7 dias — ${ativos} foco${ativos > 1 ? 's' : ''} ativo${ativos > 1 ? 's' : ''} sem acompanhamento`,
      });
    }
  }

  const ordem: Record<AlertaSeveridade, number> = { critico: 0, atencao: 1, inativo: 2 };
  return alertas.sort((a, b) => ordem[a.severidade] - ordem[b.severidade]);
}

// ── Exportar CSV ──────────────────────────────────────────────────────────────

function exportarCSV(
  kpi: RegionalKpiMunicipio[],
  usoMap: Map<string, RegionalUsoSistema>,
  scoreMap: Map<string, ScoreMunicipio>,
) {
  const headers = [
    'Município', 'UF', 'Focos Totais', 'Ativos', 'Confirmados', 'Em Tratamento',
    'Resolvidos', 'Taxa Resolução (%)', 'SLA Vencido', 'Tempo Médio (h)',
    'Score (0-100)', 'Nota', 'Eventos 7d', 'Resolvidos 7d',
  ];

  const rows = kpi.map(row => {
    const u = usoMap.get(row.cliente_id);
    const s = scoreMap.get(row.cliente_id);
    return [
      row.municipio_nome,
      row.uf ?? '',
      row.total_focos,
      row.focos_ativos,
      row.focos_confirmados,
      row.focos_em_tratamento,
      row.focos_resolvidos,
      row.taxa_resolucao_pct.toFixed(1),
      row.sla_vencido_count,
      row.tempo_medio_resolucao_horas?.toFixed(0) ?? '',
      s?.score ?? '',
      s?.grade ?? '',
      u?.eventos_7d ?? 0,
      u?.focos_resolvidos_7d ?? 0,
    ];
  });

  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `relatorio-regional-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Helpers de formatação ────────────────────────────────────────────────────

function fmt(n: number | null | undefined, decimals = 0): string {
  if (n == null) return '—';
  return n.toLocaleString('pt-BR', { maximumFractionDigits: decimals });
}

function pct(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${n.toFixed(1)}%`;
}

// ── Sub-componentes ──────────────────────────────────────────────────────────

function KpiCard({
  title, value, sub, icon: Icon, color,
}: {
  title: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <Card>
      <CardContent className="p-5 flex items-start gap-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-bold text-foreground leading-tight">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function GradeBadge({ score, grade }: { score: number; grade: string }) {
  const colorMap: Record<string, string> = {
    A: 'bg-emerald-100 text-emerald-800',
    B: 'bg-lime-100 text-lime-800',
    C: 'bg-amber-100 text-amber-800',
    D: 'bg-orange-100 text-orange-800',
    F: 'bg-red-100 text-red-800',
  };
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-sm font-mono text-muted-foreground w-7 text-right">{score}</span>
      <Badge className={`${colorMap[grade] ?? 'bg-slate-100'} border-0 w-7 text-center justify-center font-bold`}>
        {grade}
      </Badge>
    </div>
  );
}

function AlertaCard({ alerta }: { alerta: Alerta }) {
  const config = {
    critico: {
      bg: 'bg-red-50 border-red-200',
      icon: <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />,
      badge: <Badge className="bg-red-100 text-red-800 border-0 text-xs">Crítico</Badge>,
    },
    atencao: {
      bg: 'bg-amber-50 border-amber-200',
      icon: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />,
      badge: <Badge className="bg-amber-100 text-amber-800 border-0 text-xs">Atenção</Badge>,
    },
    inativo: {
      bg: 'bg-slate-50 border-slate-200',
      icon: <WifiOff className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />,
      badge: <Badge className="bg-slate-100 text-slate-700 border-0 text-xs">Inativo</Badge>,
    },
  };
  const c = config[alerta.severidade];
  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3 ${c.bg}`}>
      {c.icon}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground">{alerta.municipio_nome}</span>
          {alerta.uf && <span className="text-xs text-muted-foreground">{alerta.uf}</span>}
          {c.badge}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{alerta.mensagem}</p>
      </div>
    </div>
  );
}

// Treemap custom content
interface TreemapContentProps {
  x?: number; y?: number; width?: number; height?: number;
  nome?: string; score?: number; grade?: string; focos?: number;
}

function TreemapContent({ x = 0, y = 0, width = 0, height = 0, nome, score, grade, focos }: TreemapContentProps) {
  if (width < 40 || height < 30) return null;
  const color = scoreToColor(score ?? 0);
  const showFull = width > 100 && height > 60;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={color} fillOpacity={0.85} rx={4} stroke="white" strokeWidth={1} />
      {showFull ? (
        <>
          <text x={x + width / 2} y={y + height / 2 - 10} textAnchor="middle" fill="white" fontSize={12} fontWeight="600">
            {nome && nome.length > 14 ? nome.slice(0, 13) + '…' : nome}
          </text>
          <text x={x + width / 2} y={y + height / 2 + 8} textAnchor="middle" fill="white" fontSize={18} fontWeight="700">
            {grade}
          </text>
          <text x={x + width / 2} y={y + height / 2 + 24} textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize={10}>
            {focos} focos
          </text>
        </>
      ) : (
        <text x={x + width / 2} y={y + height / 2 + 5} textAnchor="middle" fill="white" fontSize={10} fontWeight="600">
          {grade}
        </text>
      )}
    </g>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

// ── Gráficos IA ───────────────────────────────────────────────────────────────

interface DadoGrafico {
  nome: string;
  valor: number;
  valor2?: number;
  label2?: string;
  cor?: string;
}

interface GraficoSpec {
  titulo: string;
  tipo: 'bar' | 'bar_horizontal' | 'pie' | 'line' | 'area';
  descricao?: string;
  dados: DadoGrafico[];
  cor_primaria?: string;
  unidade?: string;
}

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: '12px',
  color: 'hsl(var(--foreground))',
};

function DynamicChart({ spec }: { spec: GraficoSpec }) {
  const { tipo, dados, cor_primaria = '#7c3aed', unidade = '' } = spec;
  const fmt = (v: number) => `${v}${unidade ? ' ' + unidade : ''}`;

  if (tipo === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={dados} dataKey="valor" nameKey="nome" cx="50%" cy="50%"
            outerRadius={80} label={({ nome, percent }) => `${nome} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}>
            {dados.map((d, i) => <Cell key={i} fill={d.cor ?? cor_primaria} />)}
          </Pie>
          <Tooltip formatter={(v: number) => fmt(v)} contentStyle={TOOLTIP_STYLE} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (tipo === 'bar_horizontal') {
    return (
      <ResponsiveContainer width="100%" height={Math.max(180, dados.length * 36)}>
        <BarChart data={dados} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
          <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={fmt} />
          <YAxis type="category" dataKey="nome" tick={{ fontSize: 11 }} width={110} />
          <Tooltip formatter={(v: number) => fmt(v)} contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
            {dados.map((d, i) => <Cell key={i} fill={d.cor ?? cor_primaria} />)}
          </Bar>
          {dados[0]?.valor2 !== undefined && (
            <Bar dataKey="valor2" radius={[0, 4, 4, 0]} fill="#94a3b8" name={dados[0]?.label2 ?? 'valor2'} />
          )}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (tipo === 'line') {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={dados} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
          <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={fmt} />
          <Tooltip formatter={(v: number) => fmt(v)} contentStyle={TOOLTIP_STYLE} />
          <Legend />
          <Line type="monotone" dataKey="valor" stroke={cor_primaria} strokeWidth={2} dot={{ r: 4 }} />
          {dados[0]?.valor2 !== undefined && (
            <Line type="monotone" dataKey="valor2" stroke="#94a3b8" strokeWidth={2} dot={{ r: 4 }}
              name={dados[0]?.label2 ?? 'valor2'} />
          )}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (tipo === 'area') {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={dados} margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
          <defs>
            <linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={cor_primaria} stopOpacity={0.3} />
              <stop offset="95%" stopColor={cor_primaria} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={fmt} />
          <Tooltip formatter={(v: number) => fmt(v)} contentStyle={TOOLTIP_STYLE} />
          <Area type="monotone" dataKey="valor" stroke={cor_primaria} fill="url(#grad1)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // default: bar vertical
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={dados} margin={{ left: 0, right: 8, top: 4, bottom: 4 }}>
        <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={fmt} />
        <Tooltip formatter={(v: number) => fmt(v)} contentStyle={TOOLTIP_STYLE} />
        <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
          {dados.map((d, i) => <Cell key={i} fill={d.cor ?? cor_primaria} />)}
        </Bar>
        {dados[0]?.valor2 !== undefined && (
          <Bar dataKey="valor2" radius={[4, 4, 0, 0]} fill="#94a3b8" name={dados[0]?.label2 ?? 'valor2'} />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i} className="font-semibold text-foreground">{p.slice(2, -2)}</strong>
      : <Fragment key={i}>{p}</Fragment>
  );
}

function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = (key: string) => {
    if (listItems.length === 0) return;
    elements.push(
      <ul key={key} className="my-2 space-y-1 pl-4">
        {listItems.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm text-foreground/80">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
            <span>{renderInline(item)}</span>
          </li>
        ))}
      </ul>
    );
    listItems = [];
  };

  lines.forEach((line, idx) => {
    const key = String(idx);
    if (/^###\s/.test(line)) {
      flushList(key + 'l');
      elements.push(<h3 key={key} className="mt-4 mb-1 text-sm font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">{line.replace(/^###\s/, '')}</h3>);
    } else if (/^##\s/.test(line)) {
      flushList(key + 'l');
      elements.push(<h2 key={key} className="mt-5 mb-2 text-base font-bold text-foreground border-b border-violet-100 dark:border-violet-900 pb-1">{renderInline(line.replace(/^##\s/, ''))}</h2>);
    } else if (/^#\s/.test(line)) {
      flushList(key + 'l');
      elements.push(<h1 key={key} className="mt-2 mb-3 text-lg font-extrabold text-violet-700 dark:text-violet-300">{renderInline(line.replace(/^#\s/, ''))}</h1>);
    } else if (/^---+$/.test(line.trim())) {
      flushList(key + 'l');
      elements.push(<hr key={key} className="my-4 border-slate-200 dark:border-slate-700" />);
    } else if (/^[-*]\s/.test(line)) {
      listItems.push(line.replace(/^[-*]\s/, ''));
    } else if (line.trim() === '') {
      flushList(key + 'l');
    } else {
      flushList(key + 'l');
      elements.push(<p key={key} className="text-sm text-foreground/80 leading-relaxed">{renderInline(line)}</p>);
    }
  });
  flushList('end');

  return <div className="space-y-0.5">{elements}</div>;
}

// ── Drill-down por município ──────────────────────────────────────────────────

function MunicipioDetalheSheet({
  clienteId,
  onClose,
}: {
  clienteId: string | null;
  onClose: () => void;
}) {
  const { data, isLoading, isError } = useRegionalMunicipioDetalhe(clienteId ?? undefined, !!clienteId);

  const distVuln = data ? [
    { nome: 'Baixa',   valor: data.vulnerabilidade.vulnerabilidade_baixa,   fill: '#86efac' },
    { nome: 'Média',   valor: data.vulnerabilidade.vulnerabilidade_media,   fill: '#fde047' },
    { nome: 'Alta',    valor: data.vulnerabilidade.vulnerabilidade_alta,    fill: '#fb923c' },
    { nome: 'Crítica', valor: data.vulnerabilidade.vulnerabilidade_critica, fill: '#ef4444' },
  ] : [];

  const distRisco = data ? [
    { nome: 'Baixo',   valor: data.vulnerabilidade.risco_vetorial_baixo,   fill: '#86efac' },
    { nome: 'Médio',   valor: data.vulnerabilidade.risco_vetorial_medio,   fill: '#fde047' },
    { nome: 'Alto',    valor: data.vulnerabilidade.risco_vetorial_alto,    fill: '#fb923c' },
    { nome: 'Crítico', valor: data.vulnerabilidade.risco_vetorial_critico, fill: '#ef4444' },
  ] : [];

  const distPrioridade = data ? [
    { nome: 'P1', valor: data.vulnerabilidade.prioridade_p1, fill: '#ef4444' },
    { nome: 'P2', valor: data.vulnerabilidade.prioridade_p2, fill: '#f97316' },
    { nome: 'P3', valor: data.vulnerabilidade.prioridade_p3, fill: '#eab308' },
    { nome: 'P4', valor: data.vulnerabilidade.prioridade_p4, fill: '#84cc16' },
    { nome: 'P5', valor: data.vulnerabilidade.prioridade_p5, fill: '#22c55e' },
  ] : [];

  const evolucaoChart = data?.evolucao.slice(-6).map(r => ({
    label: formatPeriodo(r.periodo),
    total_focos: r.total_focos,
    focos_resolvidos: r.focos_resolvidos,
  })) ?? [];

  return (
    <Sheet open={!!clienteId} onOpenChange={open => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-2 h-48 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-sm">Carregando dados do município...</span>
          </div>
        ) : isError || !data ? (
          <div className="flex flex-col items-center justify-center gap-2 h-48 text-muted-foreground">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            <span className="text-sm">Não foi possível carregar os dados regionais.</span>
          </div>
        ) : (
          <div className="space-y-5 pb-8">
            {/* Cabeçalho */}
            <SheetHeader className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <SheetTitle className="text-lg">{data.cliente.nome}</SheetTitle>
                <Badge className="bg-violet-100 text-violet-800 border-0 text-xs">Análise regional</Badge>
              </div>
              {(data.cliente.cidade || data.cliente.uf) && (
                <p className="text-sm text-muted-foreground">
                  {[data.cliente.cidade, data.cliente.uf].filter(Boolean).join(' · ')}
                </p>
              )}
            </SheetHeader>

            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: 'Focos totais',  value: fmt(data.resumo.total_focos) },
                { label: 'Ativos',        value: fmt(data.resumo.focos_ativos) },
                { label: 'Resolvidos',    value: fmt(data.resumo.focos_resolvidos) },
                { label: 'Taxa resolução',value: pct(data.resumo.taxa_resolucao_pct) },
                { label: 'Vistorias',     value: fmt(data.resumo.total_vistorias) },
                { label: 'Vuln. crítica', value: fmt(data.resumo.vulnerabilidade_critica_count) },
                { label: 'Risco vet. crit.', value: fmt(data.resumo.risco_vetorial_critico_count) },
                { label: 'Prioridade P1', value: fmt(data.resumo.prioridade_p1_count) },
              ].map(k => (
                <Card key={k.label}>
                  <CardContent className="pt-3 pb-2">
                    <p className="text-xs text-muted-foreground">{k.label}</p>
                    <p className="text-xl font-bold font-mono">{k.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Distribuição vulnerabilidade */}
            <Card>
              <CardHeader className="pb-1"><CardTitle className="text-sm">Distribuição — Vulnerabilidade & Risco</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Vulnerabilidade domiciliar</p>
                  <div className="flex gap-2 flex-wrap">
                    {distVuln.map(d => (
                      <div key={d.nome} className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                        <span className="text-xs">{d.nome}: <strong>{d.valor}</strong></span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Risco vetorial</p>
                  <div className="flex gap-2 flex-wrap">
                    {distRisco.map(d => (
                      <div key={d.nome} className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                        <span className="text-xs">{d.nome}: <strong>{d.valor}</strong></span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Alertas saúde — urgente: <strong>{data.vulnerabilidade.alerta_saude_urgente}</strong> / atenção: <strong>{data.vulnerabilidade.alerta_saude_atencao}</strong> / normal: <strong>{data.vulnerabilidade.alerta_saude_normal}</strong></p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Prioridades (vistorias)</p>
                  <div className="flex gap-2 flex-wrap">
                    {distPrioridade.map(d => (
                      <div key={d.nome} className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                        <span className="text-xs">{d.nome}: <strong>{d.valor}</strong></span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Evolução — últimos 6 meses */}
            {evolucaoChart.length > 0 && (
              <Card>
                <CardHeader className="pb-1"><CardTitle className="text-sm flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Evolução — últimos 6 meses</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={evolucaoChart} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => fmt(v)} contentStyle={TOOLTIP_STYLE} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="total_focos" stroke="#4F46E5" strokeWidth={2} name="Total" dot={false} />
                      <Line type="monotone" dataKey="focos_resolvidos" stroke="#10B981" strokeWidth={2} name="Resolvidos" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                  <Table className="mt-2">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Período</TableHead>
                        <TableHead className="text-right text-xs">Focos</TableHead>
                        <TableHead className="text-right text-xs">Resolvidos</TableHead>
                        <TableHead className="text-right text-xs">Taxa</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.evolucao.slice(-6).map(r => (
                        <TableRow key={r.periodo}>
                          <TableCell className="font-mono text-xs py-1">{formatPeriodo(r.periodo)}</TableCell>
                          <TableCell className="text-right font-mono text-xs py-1">{fmt(r.total_focos)}</TableCell>
                          <TableCell className="text-right font-mono text-xs py-1">{fmt(r.focos_resolvidos)}</TableCell>
                          <TableCell className="text-right text-xs py-1">{pct(r.taxa_resolucao_pct)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Comparativo */}
            {data.comparativo && (
              <Card>
                <CardHeader className="pb-1"><CardTitle className="text-sm flex items-center gap-1.5"><ArrowLeftRight className="w-3.5 h-3.5" /> Comparativo — últimos 30 dias</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-xs text-muted-foreground mb-3">
                    Atual: {data.comparativo.periodo_atual.data_inicio} → {data.comparativo.periodo_atual.data_fim} ·
                    Anterior: {data.comparativo.periodo_anterior.data_inicio} → {data.comparativo.periodo_anterior.data_fim}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { label: 'Focos', atual: data.comparativo.periodo_atual.total_focos, anterior: data.comparativo.periodo_anterior.total_focos, var_: data.comparativo.variacao.total_focos_pct, sentido: 'melhor_baixo' },
                      { label: 'Resolvidos', atual: data.comparativo.periodo_atual.focos_resolvidos, anterior: data.comparativo.periodo_anterior.focos_resolvidos, var_: data.comparativo.variacao.focos_resolvidos_pct, sentido: 'melhor_alto' },
                      { label: 'Vistorias', atual: data.comparativo.periodo_atual.total_vistorias, anterior: data.comparativo.periodo_anterior.total_vistorias, var_: data.comparativo.variacao.total_vistorias_pct, sentido: 'melhor_alto' },
                      { label: 'Taxa resolução', atual: `${data.comparativo.periodo_atual.taxa_resolucao_pct.toFixed(1)}%`, anterior: `${data.comparativo.periodo_anterior.taxa_resolucao_pct.toFixed(1)}%`, var_: data.comparativo.variacao.taxa_resolucao_pp, sentido: 'melhor_alto' },
                    ] as { label: string; atual: string | number; anterior: string | number; var_: number | null; sentido: 'melhor_alto' | 'melhor_baixo' }[]).map(c => {
                      const interp = interpretacao(c.var_, c.sentido);
                      return (
                        <div key={c.label} className="rounded-lg border p-2.5">
                          <p className="text-xs text-muted-foreground">{c.label}</p>
                          <p className="text-base font-bold font-mono">{String(c.atual)}</p>
                          <p className="text-xs text-muted-foreground">ant. {String(c.anterior)}</p>
                          {c.var_ === null ? (
                            <p className="text-xs font-medium mt-0.5 text-slate-500">Sem base anterior</p>
                          ) : (
                            <p className={`text-xs font-medium mt-0.5 ${interp.color}`}>
                              {fmtVariacao(c.var_, c.label === 'Taxa resolução' ? 'pp' : '%')} · {interp.label}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ── Comparativo de períodos ───────────────────────────────────────────────────

function fmtVariacao(v: number | null, unit = '%'): string {
  if (v === null) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(1)}${unit}`;
}

function interpretacao(v: number | null, sentido: 'melhor_alto' | 'melhor_baixo'): { label: string; color: string } {
  if (v === null) return { label: 'Sem base anterior', color: 'text-slate-500' };
  if (Math.abs(v) < 1) return { label: 'Estável', color: 'text-slate-600' };
  const subiu = v > 0;
  if (sentido === 'melhor_alto') {
    return subiu ? { label: 'Melhorou', color: 'text-emerald-600' } : { label: 'Piorou', color: 'text-red-600' };
  }
  return subiu ? { label: 'Piorou', color: 'text-red-600' } : { label: 'Melhorou', color: 'text-emerald-600' };
}

function ComparativoContent({ data }: { data: RegionalComparativoResponse }) {
  const { periodo_atual, periodo_anterior, variacao } = data;

  const cards: {
    label: string;
    atual: string | number;
    anterior: string | number;
    var: number | null;
    sentido: 'melhor_alto' | 'melhor_baixo';
    unit: string;
  }[] = [
    { label: 'Total focos',       atual: periodo_atual.total_focos,                anterior: periodo_anterior.total_focos,                var: variacao.total_focos_pct,             sentido: 'melhor_baixo', unit: '%' },
    { label: 'Focos ativos',      atual: periodo_atual.focos_ativos,               anterior: periodo_anterior.focos_ativos,               var: variacao.focos_ativos_pct,            sentido: 'melhor_baixo', unit: '%' },
    { label: 'Focos resolvidos',  atual: periodo_atual.focos_resolvidos,           anterior: periodo_anterior.focos_resolvidos,           var: variacao.focos_resolvidos_pct,        sentido: 'melhor_alto',  unit: '%' },
    { label: 'Taxa resolução',    atual: `${periodo_atual.taxa_resolucao_pct.toFixed(1)}%`,  anterior: `${periodo_anterior.taxa_resolucao_pct.toFixed(1)}%`,  var: variacao.taxa_resolucao_pp, sentido: 'melhor_alto', unit: 'pp' },
    { label: 'Total vistorias',   atual: periodo_atual.total_vistorias,            anterior: periodo_anterior.total_vistorias,            var: variacao.total_vistorias_pct,         sentido: 'melhor_alto',  unit: '%' },
    { label: 'Vuln. crítica',     atual: periodo_atual.vulnerabilidade_critica_count, anterior: periodo_anterior.vulnerabilidade_critica_count, var: variacao.vulnerabilidade_critica_pct, sentido: 'melhor_baixo', unit: '%' },
    { label: 'Risco vet. crítico',atual: periodo_atual.risco_vetorial_critico_count, anterior: periodo_anterior.risco_vetorial_critico_count, var: variacao.risco_vetorial_critico_pct, sentido: 'melhor_baixo', unit: '%' },
    { label: 'Alertas urgentes',  atual: periodo_atual.alerta_saude_urgente_count, anterior: periodo_anterior.alerta_saude_urgente_count, var: variacao.alerta_saude_urgente_pct,    sentido: 'melhor_baixo', unit: '%' },
    { label: 'Prioridade P1',     atual: periodo_atual.prioridade_p1_count,        anterior: periodo_anterior.prioridade_p1_count,        var: variacao.prioridade_p1_pct,           sentido: 'melhor_baixo', unit: '%' },
  ];

  return (
    <div className="space-y-4">
      {/* Cabeçalho dos períodos */}
      <div className="flex flex-wrap gap-3">
        <Card className="flex-1 min-w-[160px]">
          <CardContent className="pt-3 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Período atual</p>
            <p className="text-sm font-semibold font-mono">{periodo_atual.data_inicio} → {periodo_atual.data_fim}</p>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[160px]">
          <CardContent className="pt-3 pb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Período anterior</p>
            <p className="text-sm font-semibold font-mono">{periodo_anterior.data_inicio} → {periodo_anterior.data_fim}</p>
          </CardContent>
        </Card>
      </div>

      {/* 9 cards comparativos em grade 3×3 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cards.map(c => {
          const interp = interpretacao(c.var, c.sentido);
          const varStr = fmtVariacao(c.var, c.unit);
          const isNull = c.var === null;
          const isUp = !isNull && c.var! > 0;
          const arrowClass = isNull
            ? 'text-slate-400'
            : c.sentido === 'melhor_alto'
              ? (isUp ? 'text-emerald-600' : 'text-red-600')
              : (isUp ? 'text-red-600' : 'text-emerald-600');
          const arrow = isNull ? '—' : isUp ? '↑' : (c.var === 0 ? '→' : '↓');
          return (
            <Card key={c.label}>
              <CardContent className="pt-4 pb-4">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">{c.label}</p>
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <p className="text-xl font-bold font-mono">{String(c.atual)}</p>
                    <p className="text-xs text-muted-foreground">ant. {String(c.anterior)}</p>
                  </div>
                  <div className="text-right">
                    {isNull ? (
                      <p className="text-xs font-medium text-slate-500 mt-1">Sem base anterior</p>
                    ) : (
                      <>
                        <p className={`text-base font-bold font-mono ${arrowClass}`}>{arrow} {varStr}</p>
                        <p className={`text-xs font-medium ${interp.color}`}>{interp.label}</p>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabela resumo */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Resumo comparativo</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Indicador</TableHead>
                <TableHead className="text-right">Anterior</TableHead>
                <TableHead className="text-right">Atual</TableHead>
                <TableHead className="text-right">Variação</TableHead>
                <TableHead>Interpretação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cards.map(c => {
                const interp = interpretacao(c.var, c.sentido);
                return (
                  <TableRow key={c.label}>
                    <TableCell className="font-medium text-sm">{c.label}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{String(c.anterior)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{String(c.atual)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmtVariacao(c.var, c.unit)}</TableCell>
                    <TableCell><span className={`text-xs font-medium ${interp.color}`}>{interp.label}</span></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Evolução temporal ─────────────────────────────────────────────────────────

const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
function formatPeriodo(periodo: string): string {
  const [year, month] = periodo.split('-');
  return `${MESES_PT[parseInt(month, 10) - 1]}/${year.slice(2)}`;
}

function EvolucaoContent({ evolucao }: { evolucao: RegionalEvolucaoItem[] }) {
  const totalFocos      = evolucao.reduce((s, r) => s + r.total_focos, 0);
  const totalResolvidos = evolucao.reduce((s, r) => s + r.focos_resolvidos, 0);
  const totalVistorias  = evolucao.reduce((s, r) => s + r.total_vistorias, 0);
  const totalVulnCrit   = evolucao.reduce((s, r) => s + r.vulnerabilidade_critica_count, 0);
  const taxaMedia = evolucao.length
    ? evolucao.reduce((s, r) => s + r.taxa_resolucao_pct, 0) / evolucao.length
    : 0;

  const chartData = evolucao.map(r => ({ ...r, label: formatPeriodo(r.periodo) }));

  return (
    <div className="space-y-4">
      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total focos</p>
            <p className="text-2xl font-bold font-mono">{fmt(totalFocos)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Resolvidos</p>
            <p className="text-2xl font-bold font-mono text-emerald-600">{fmt(totalResolvidos)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Taxa média resolução</p>
            <p className="text-2xl font-bold font-mono">{pct(taxaMedia)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Total vistorias</p>
            <p className="text-2xl font-bold font-mono">{fmt(totalVistorias)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Vuln. crítica acum.</p>
            <p className="text-2xl font-bold font-mono text-red-600">{fmt(totalVulnCrit)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de linha: focos totais vs resolvidos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Focos por Mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="total_focos" stroke="#4F46E5" strokeWidth={2} name="Total focos" dot={false} />
              <Line type="monotone" dataKey="focos_resolvidos" stroke="#10B981" strokeWidth={2} name="Resolvidos" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráfico de barras: indicadores críticos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Indicadores Críticos por Mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="vulnerabilidade_critica_count" fill="#DC2626" name="Vuln. Crítica" />
              <Bar dataKey="risco_vetorial_critico_count"  fill="#D97706" name="Risco Vet. Crítico" />
              <Bar dataKey="alerta_saude_urgente_count"    fill="#7C3AED" name="Alert. Urgentes" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tabela mensal */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Detalhamento Mensal</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Focos</TableHead>
                <TableHead className="text-right">Resolvidos</TableHead>
                <TableHead className="text-right">Taxa Res.</TableHead>
                <TableHead className="text-right">Vistorias</TableHead>
                <TableHead className="text-right">Vuln. Crit.</TableHead>
                <TableHead className="text-right">Risco Crit.</TableHead>
                <TableHead className="text-right">Alert. Urg.</TableHead>
                <TableHead className="text-right">P1</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {evolucao.map((row) => (
                <TableRow key={row.periodo}>
                  <TableCell className="font-mono text-sm">{formatPeriodo(row.periodo)}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(row.total_focos)}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(row.focos_resolvidos)}</TableCell>
                  <TableCell className="text-right">
                    <Badge className={`border-0 text-xs ${row.taxa_resolucao_pct >= 70 ? 'bg-emerald-100 text-emerald-800' : row.taxa_resolucao_pct >= 40 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                      {pct(row.taxa_resolucao_pct)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{fmt(row.total_vistorias)}</TableCell>
                  <TableCell className="text-right font-mono text-red-600">{fmt(row.vulnerabilidade_critica_count)}</TableCell>
                  <TableCell className="text-right font-mono text-amber-600">{fmt(row.risco_vetorial_critico_count)}</TableCell>
                  <TableCell className="text-right font-mono text-violet-600">{fmt(row.alerta_saude_urgente_count)}</TableCell>
                  <TableCell className="text-right font-mono">{fmt(row.prioridade_p1_count)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default function RegionalDashboard() {
  const { agrupamentoId } = useClienteAtivo();
  const [insights, setInsights] = useState<string | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [geradoEm, setGeradoEm] = useState<string | null>(null);

  const [graficos, setGraficos] = useState<GraficoSpec[] | null>(null);
  const [graficosResumo, setGraficosResumo] = useState<string | null>(null);
  const [graficosLoading, setGraficosLoading] = useState(false);
  const [graficosError, setGraficosError] = useState<string | null>(null);
  const [graficosGeradoEm, setGraficosGeradoEm] = useState<string | null>(null);

  const [exportandoCsv, setExportandoCsv] = useState(false);
  const [exportandoPdf, setExportandoPdf] = useState(false);
  const [detalheClienteId, setDetalheClienteId] = useState<string | null>(null);

  const { data: kpi = [], isLoading: loadingKpi, isError: errorKpi, refetch: refetchKpi } = useRegionalKpi();
  const { data: sla = [], isLoading: loadingSla } = useRegionalSla();
  const { data: uso = [], isLoading: loadingUso } = useRegionalUso();
  const { data: resumo = [] } = useRegionalResumo();
  const { data: vulnerabilidade = [] } = useRegionalVulnerabilidade();
  const { data: evolucao = [], isLoading: loadingEvolucao } = useRegionalEvolucao();
  const { data: comparativo, isLoading: loadingComparativo } = useRegionalComparativo();

  const loading = loadingKpi || loadingSla || loadingUso;

  // Maps para lookup rápido
  const usoMap = useMemo(() => new Map<string, RegionalUsoSistema>(uso.map(u => [u.cliente_id, u])), [uso]);
  const slaMap = useMemo(() => new Map<string, RegionalSlaMunicipio>(sla.map(s => [s.cliente_id, s])), [sla]);

  // Score de saúde por município
  const scoreMap = useMemo(() => {
    const m = new Map<string, ScoreMunicipio>();
    for (const row of kpi) {
      const score = calcularScore(row, usoMap.get(row.cliente_id));
      m.set(row.cliente_id, { cliente_id: row.cliente_id, score, grade: gradeFromScore(score) });
    }
    return m;
  }, [kpi, usoMap]);

  // Totais agregados
  const totais = useMemo(() => ({
    municipios: kpi.length,
    totalFocos: kpi.reduce((s, r) => s + r.total_focos, 0),
    resolvidos: kpi.reduce((s, r) => s + r.focos_resolvidos, 0),
    slaVencido: kpi.reduce((s, r) => s + r.sla_vencido_count, 0),
    taxaMedia: kpi.length
      ? kpi.reduce((s, r) => s + r.taxa_resolucao_pct, 0) / kpi.length
      : 0,
    scoreRegional: kpi.length
      ? Math.round([...scoreMap.values()].reduce((s, v) => s + v.score, 0) / kpi.length)
      : 0,
  }), [kpi, scoreMap]);

  // Alertas proativos
  const alertas = useMemo(() => calcularAlertas(kpi, usoMap), [kpi, usoMap]);
  const alertasCriticos = alertas.filter(a => a.severidade === 'critico').length;

  // Rankings
  const rankingMaisFocos = useMemo(
    () => [...kpi].sort((a, b) => b.total_focos - a.total_focos).slice(0, 5),
    [kpi],
  );
  const rankingMelhorScore = useMemo(
    () => [...kpi]
      .filter(r => r.total_focos > 0)
      .sort((a, b) => (scoreMap.get(b.cliente_id)?.score ?? 0) - (scoreMap.get(a.cliente_id)?.score ?? 0))
      .slice(0, 5),
    [kpi, scoreMap],
  );
  const rankingMaiorSla = useMemo(
    () => [...kpi].sort((a, b) => b.sla_vencido_count - a.sla_vencido_count).slice(0, 5),
    [kpi],
  );

  // Totais do resumo consolidado
  const totaisResumo = useMemo(() => ({
    p1: resumo.reduce((s, r) => s + r.prioridade_p1_count, 0),
    p2: resumo.reduce((s, r) => s + r.prioridade_p2_count, 0),
    vistorias: resumo.reduce((s, r) => s + r.total_vistorias, 0),
    visitadas: resumo.reduce((s, r) => s + r.vistorias_visitadas, 0),
    vulnCritica: resumo.reduce((s, r) => s + r.vulnerabilidade_critica_count, 0),
    vulnAlta: resumo.reduce((s, r) => s + r.vulnerabilidade_alta_count, 0),
    riscoVetCritico: resumo.reduce((s, r) => s + r.risco_vetorial_critico_count, 0),
    alertaSaude: resumo.reduce((s, r) => s + r.alerta_saude_urgente_count, 0),
  }), [resumo]);

  const rankingVulnerabilidade = useMemo(
    () => [...resumo]
      .sort((a, b) => (b.vulnerabilidade_critica_count + b.vulnerabilidade_alta_count) - (a.vulnerabilidade_critica_count + a.vulnerabilidade_alta_count))
      .slice(0, 5),
    [resumo],
  );

  const rankingRiscoVetorial = useMemo(
    () => [...resumo]
      .sort((a, b) => (b.risco_vetorial_critico_count + b.risco_vetorial_alto_count) - (a.risco_vetorial_critico_count + a.risco_vetorial_alto_count))
      .slice(0, 5),
    [resumo],
  );

  // Rankings de vulnerabilidade
  const rankingVulnCritica = useMemo(
    () => [...vulnerabilidade].sort((a, b) => b.vulnerabilidade_critica - a.vulnerabilidade_critica).slice(0, 5),
    [vulnerabilidade],
  );
  const rankingRiscoVet = useMemo(
    () => [...vulnerabilidade].sort((a, b) => (b.risco_vetorial_critico + b.risco_vetorial_alto) - (a.risco_vetorial_critico + a.risco_vetorial_alto)).slice(0, 5),
    [vulnerabilidade],
  );
  const rankingAlertaSaude = useMemo(
    () => [...vulnerabilidade].sort((a, b) => b.alerta_saude_urgente - a.alerta_saude_urgente).slice(0, 5),
    [vulnerabilidade],
  );
  const rankingP1 = useMemo(
    () => [...vulnerabilidade].sort((a, b) => b.prioridade_p1 - a.prioridade_p1).slice(0, 5),
    [vulnerabilidade],
  );

  // Dados para treemap
  const treemapData = useMemo(() =>
    kpi
      .filter(r => r.total_focos > 0)
      .map(r => {
        const s = scoreMap.get(r.cliente_id);
        return {
          name: r.municipio_nome,
          size: r.total_focos,
          score: s?.score ?? 0,
          grade: s?.grade ?? 'F',
          focos: r.total_focos,
          nome: r.municipio_nome,
        };
      }),
    [kpi, scoreMap],
  );

  // Dados para SLA bars
  const slaBarData = useMemo(() =>
    sla.slice(0, 10).map(s => ({
      name: s.municipio_nome.length > 12 ? s.municipio_nome.slice(0, 11) + '…' : s.municipio_nome,
      'OK': s.sla_ok,
      'Atenção': s.sla_atencao,
      'Crítico': s.sla_critico,
      'Vencido': s.sla_vencido,
    })),
    [sla],
  );

  // Gerar insights IA
  const gerarInsights = useCallback(async () => {
    setInsightsLoading(true);
    setInsightsError(null);
    try {
      const data = await http.post<{ insights?: string | string[] | null; gerado_em?: string | null }>('/ia/insights-regional', {});
      const raw = data?.insights ?? null;
      setInsights(Array.isArray(raw) ? raw.join('\n\n') : raw);
      setGeradoEm(data?.gerado_em ?? null);
    } catch (err) {
      setInsightsError('Não foi possível gerar a análise. Verifique sua conexão e tente novamente.');
      console.error('[insights-regional]', err);
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  // Download CSV autenticado do backend (dados completos resumo + vulnerabilidade)
  const downloadCSV = useCallback(async () => {
    setExportandoCsv(true);
    try {
      const token = tokenStore.getAccessToken();
      const baseUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
      const res = await fetch(`${baseUrl}/analytics/regional/relatorio.csv`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-regional-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[exportar-csv]', err);
    } finally {
      setExportandoCsv(false);
    }
  }, []);

  // Download PDF autenticado do backend (relatório executivo oficial)
  const gerarPDF = useCallback(async () => {
    setExportandoPdf(true);
    try {
      const token = tokenStore.getAccessToken();
      const baseUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
      const res = await fetch(`${baseUrl}/analytics/regional/relatorio.pdf`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-regional-sentinella-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[exportar-pdf]', err);
    } finally {
      setExportandoPdf(false);
    }
  }, []);

  // Gerar gráficos IA
  const gerarGraficos = useCallback(async () => {
    setGraficosLoading(true);
    setGraficosError(null);
    try {
      const data = await http.post<{ graficos?: unknown; resumo?: unknown; gerado_em?: string | null }>('/ia/graficos-regionais', {});
      setGraficos(data?.graficos ?? null);
      setGraficosResumo(data?.resumo ?? null);
      setGraficosGeradoEm(data?.gerado_em ?? null);
    } catch (err) {
      setGraficosError('Não foi possível gerar os gráficos. Verifique sua conexão e tente novamente.');
      console.error('[graficos-regionais]', err);
    } finally {
      setGraficosLoading(false);
    }
  }, []);

  // ── Estados de loading / erro / vazio ──────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (errorKpi) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center space-y-3 mt-16">
        <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
        <h2 className="text-lg font-semibold">Erro ao carregar dados</h2>
        <p className="text-sm text-muted-foreground">
          Não foi possível obter os dados do painel regional.
        </p>
        <Button variant="outline" size="sm" onClick={() => refetchKpi()}>Tentar novamente</Button>
      </div>
    );
  }

  if (kpi.length === 0) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center space-y-3 mt-16">
        <MapPin className="w-12 h-12 text-muted-foreground mx-auto" />
        <h2 className="text-lg font-semibold">Nenhum município vinculado</h2>
        <p className="text-sm text-muted-foreground">
          {agrupamentoId
            ? 'O agrupamento regional ainda não tem municípios vinculados. Solicite ao administrador da plataforma.'
            : 'Usuário sem agrupamento regional configurado. Contate o administrador.'}
        </p>
      </div>
    );
  }

  const scoreGrade = gradeFromScore(totais.scoreRegional);
  const scoreColor = scoreToColor(totais.scoreRegional);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel Regional</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Painel analítico regional — dados consolidados de {totais.municipios} município{totais.municipios !== 1 ? 's' : ''} vinculado{totais.municipios !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={downloadCSV}
            disabled={exportandoCsv}
            className="gap-2"
            aria-label={exportandoCsv ? 'Exportando CSV...' : 'Exportar relatório CSV'}
          >
            {exportandoCsv
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Download className="w-3.5 h-3.5" />}
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={gerarPDF}
            disabled={exportandoPdf}
            className="gap-2"
            aria-label={exportandoPdf ? 'Gerando PDF...' : 'Exportar relatório PDF'}
          >
            {exportandoPdf
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <FileText className="w-3.5 h-3.5" />}
            PDF
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard title="Municípios" value={totais.municipios} icon={MapPin} color="bg-blue-50 text-blue-600" />
        <KpiCard title="Total focos" value={fmt(totais.totalFocos)} icon={Activity} color="bg-amber-50 text-amber-600" />
        <KpiCard title="Resolvidos" value={fmt(totais.resolvidos)} sub={`Taxa média ${pct(totais.taxaMedia)}`} icon={CheckCircle2} color="bg-emerald-50 text-emerald-600" />
        <KpiCard
          title="SLA vencido"
          value={fmt(totais.slaVencido)}
          sub={alertasCriticos > 0 ? `${alertasCriticos} município${alertasCriticos > 1 ? 's' : ''} crítico${alertasCriticos > 1 ? 's' : ''}` : 'dentro do prazo'}
          icon={AlertTriangle}
          color={totais.slaVencido > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500'}
        />
        {/* Score Regional */}
        <Card className="col-span-2 md:col-span-1">
          <CardContent className="p-5 flex items-center gap-3">
            <div
              className="w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0 text-white font-bold"
              style={{ backgroundColor: scoreColor }}
            >
              <span className="text-2xl leading-none">{scoreGrade}</span>
              <span className="text-xs font-normal opacity-90">{totais.scoreRegional}</span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Score regional</p>
              <p className="text-sm font-semibold text-foreground leading-tight mt-0.5">Saúde média</p>
              <p className="text-xs text-muted-foreground">resolução + SLA + uso + velocidade</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="visao-geral">
        <TabsList className="flex w-full overflow-x-auto scrollbar-none">
          <TabsTrigger value="visao-geral" className="gap-1.5 text-xs shrink-0 flex-1">
            <BarChart3 className="w-3.5 h-3.5" /> Visão Geral
          </TabsTrigger>
          <TabsTrigger value="vulnerabilidade" className="gap-1.5 text-xs shrink-0 flex-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Vulnerabilidade
          </TabsTrigger>
          <TabsTrigger value="evolucao" className="gap-1.5 text-xs shrink-0 flex-1">
            <TrendingUp className="w-3.5 h-3.5" /> Evolução
          </TabsTrigger>
          <TabsTrigger value="comparativo" className="gap-1.5 text-xs shrink-0 flex-1">
            <ArrowLeftRight className="w-3.5 h-3.5" /> Comparativo
          </TabsTrigger>
          <TabsTrigger value="mapa-visual" className="gap-1.5 text-xs shrink-0 flex-1">
            <MapIcon className="w-3.5 h-3.5" /> Mapa Visual
          </TabsTrigger>
          <TabsTrigger value="alertas" className="gap-1.5 text-xs shrink-0 flex-1">
            <AlertCircle className="w-3.5 h-3.5" />
            Alertas
            {alertas.length > 0 && (
              <span className={`ml-1 text-xs font-bold px-1.5 py-0.5 rounded-full ${alertasCriticos > 0 ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'}`}>
                {alertas.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="insights-ia" className="gap-1.5 text-xs shrink-0 flex-1">
            <Sparkles className="w-3.5 h-3.5" /> Insights IA
          </TabsTrigger>
          <TabsTrigger value="graficos-ia" className="gap-1.5 text-xs shrink-0 flex-1">
            <PieIcon className="w-3.5 h-3.5" /> Gráficos IA
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Visão Geral ─────────────────────────────────────────────── */}
        <TabsContent value="visao-geral" className="space-y-4 mt-4">

          {/* Tabela comparativa com score */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Comparativo por município</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Município / UF</TableHead>
                    <TableHead className="text-center">Nota</TableHead>
                    <TableHead className="text-right">Focos</TableHead>
                    <TableHead className="text-right">Ativos</TableHead>
                    <TableHead className="text-right">Resolvidos</TableHead>
                    <TableHead className="text-right">Taxa resolução</TableHead>
                    <TableHead className="text-right">SLA vencido</TableHead>
                    <TableHead className="text-right">Eventos 7d</TableHead>
                    <TableHead className="text-right">Último evento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kpi.map((row: RegionalKpiMunicipio) => {
                    const u = usoMap.get(row.cliente_id);
                    const s = scoreMap.get(row.cliente_id);
                    const ultimoEvento = u?.ultimo_evento_em
                      ? new Date(u.ultimo_evento_em).toLocaleDateString('pt-BR')
                      : '—';
                    return (
                      <TableRow
                        key={row.cliente_id}
                        className="cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                        role="button"
                        tabIndex={0}
                        aria-label={`Ver análise de ${row.municipio_nome}`}
                        onClick={() => setDetalheClienteId(row.cliente_id)}
                        onKeyDown={e => e.key === 'Enter' && setDetalheClienteId(row.cliente_id)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="font-medium">{row.municipio_nome}</div>
                              {row.uf && <div className="text-xs text-muted-foreground">{row.cidade} · {row.uf}</div>}
                            </div>
                            <Search className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {s && <GradeBadge score={s.score} grade={s.grade} />}
                        </TableCell>
                        <TableCell className="text-right font-mono">{fmt(row.total_focos)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(row.focos_ativos)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(row.focos_resolvidos)}</TableCell>
                        <TableCell className="text-right">
                          <Badge className={`border-0 ${row.taxa_resolucao_pct >= 70 ? 'bg-emerald-100 text-emerald-800' : row.taxa_resolucao_pct >= 40 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                            {pct(row.taxa_resolucao_pct)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge className={`border-0 ${row.sla_vencido_count === 0 ? 'bg-emerald-100 text-emerald-800' : row.sla_vencido_count <= 3 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                            {row.sla_vencido_count}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">{fmt(u?.eventos_7d)}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">{ultimoEvento}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Rankings */}
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber-500" /> Mais focos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {rankingMaisFocos.map((r, i) => (
                  <div key={r.cliente_id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground w-5 text-center">{i + 1}</span>
                    <span className="flex-1 truncate ml-2 font-medium">{r.municipio_nome}</span>
                    <span className="font-mono font-bold">{fmt(r.total_focos)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" /> Melhor nota de saúde
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {rankingMelhorScore.map((r, i) => {
                  const s = scoreMap.get(r.cliente_id);
                  return (
                    <div key={r.cliente_id} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground w-5 text-center">{i + 1}</span>
                      <span className="flex-1 truncate ml-2 font-medium">{r.municipio_nome}</span>
                      {s && <GradeBadge score={s.score} grade={s.grade} />}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" /> Maior SLA vencido
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {rankingMaiorSla.map((r, i) => (
                  <div key={r.cliente_id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground w-5 text-center">{i + 1}</span>
                    <span className="flex-1 truncate ml-2 font-medium">{r.municipio_nome}</span>
                    <span className={`font-mono font-bold ${r.sla_vencido_count > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                      {fmt(r.sla_vencido_count)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* ── Resumo consolidado (vistorias, vulnerabilidade, risco, prioridade) ── */}
          {resumo.length > 0 && (
            <>
              {/* KPI cards de campo */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard
                  title="Focos P1 ativos"
                  value={fmt(totaisResumo.p1)}
                  sub={`+ ${fmt(totaisResumo.p2)} em P2`}
                  icon={AlertCircle}
                  color="bg-red-50 text-red-600"
                />
                <KpiCard
                  title="Vistorias realizadas"
                  value={fmt(totaisResumo.visitadas)}
                  sub={`de ${fmt(totaisResumo.vistorias)} agendadas`}
                  icon={Activity}
                  color="bg-blue-50 text-blue-600"
                />
                <KpiCard
                  title="Vulnerabilidade crítica"
                  value={fmt(totaisResumo.vulnCritica)}
                  sub={`+ ${fmt(totaisResumo.vulnAlta)} alta`}
                  icon={AlertTriangle}
                  color={totaisResumo.vulnCritica > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500'}
                />
                <KpiCard
                  title="Risco vetorial crítico"
                  value={fmt(totaisResumo.riscoVetCritico)}
                  sub={totaisResumo.alertaSaude > 0 ? `${fmt(totaisResumo.alertaSaude)} alertas saúde` : 'sem alertas urgentes'}
                  icon={AlertTriangle}
                  color={totaisResumo.riscoVetCritico > 0 ? 'bg-orange-50 text-orange-600' : 'bg-slate-50 text-slate-500'}
                />
              </div>

              {/* Rankings — Vulnerabilidade e Risco vetorial */}
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500" /> Ranking de vulnerabilidade
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-0">
                    {rankingVulnerabilidade.map((r: RegionalResumoMunicipio, i: number) => {
                      const total = r.vulnerabilidade_critica_count + r.vulnerabilidade_alta_count;
                      return (
                        <div key={r.cliente_id} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground w-5 text-center">{i + 1}</span>
                          <span className="flex-1 truncate ml-2 font-medium">{r.municipio_nome}</span>
                          <div className="flex items-center gap-1.5 text-xs">
                            {r.vulnerabilidade_critica_count > 0 && (
                              <Badge className="bg-red-100 text-red-800 border-0">{r.vulnerabilidade_critica_count} crit.</Badge>
                            )}
                            {r.vulnerabilidade_alta_count > 0 && (
                              <Badge className="bg-orange-100 text-orange-800 border-0">{r.vulnerabilidade_alta_count} alta</Badge>
                            )}
                            {total === 0 && <span className="text-muted-foreground">—</span>}
                          </div>
                        </div>
                      );
                    })}
                    {rankingVulnerabilidade.length === 0 && (
                      <p className="text-xs text-muted-foreground py-2">Sem dados de vulnerabilidade registrados</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-orange-500" /> Ranking de risco vetorial
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-0">
                    {rankingRiscoVetorial.map((r: RegionalResumoMunicipio, i: number) => {
                      const total = r.risco_vetorial_critico_count + r.risco_vetorial_alto_count;
                      return (
                        <div key={r.cliente_id} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground w-5 text-center">{i + 1}</span>
                          <span className="flex-1 truncate ml-2 font-medium">{r.municipio_nome}</span>
                          <div className="flex items-center gap-1.5 text-xs">
                            {r.risco_vetorial_critico_count > 0 && (
                              <Badge className="bg-red-100 text-red-800 border-0">{r.risco_vetorial_critico_count} crit.</Badge>
                            )}
                            {r.risco_vetorial_alto_count > 0 && (
                              <Badge className="bg-orange-100 text-orange-800 border-0">{r.risco_vetorial_alto_count} alto</Badge>
                            )}
                            {total === 0 && <span className="text-muted-foreground">—</span>}
                          </div>
                        </div>
                      );
                    })}
                    {rankingRiscoVetorial.length === 0 && (
                      <p className="text-xs text-muted-foreground py-2">Sem dados de risco vetorial registrados</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}

        </TabsContent>

        {/* ── Tab: Mapa Visual ─────────────────────────────────────────────── */}
        <TabsContent value="mapa-visual" className="space-y-4 mt-4">

          {/* Legenda de cores */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
            <span className="font-medium">Score:</span>
            {[
              { label: 'A ≥85', color: '#10b981' }, { label: 'B ≥70', color: '#84cc16' },
              { label: 'C ≥50', color: '#f59e0b' }, { label: 'D ≥30', color: '#f97316' },
              { label: 'F <30', color: '#ef4444' },
            ].map(item => (
              <span key={item.label} className="flex items-center gap-1">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: item.color }} />
                {item.label}
              </span>
            ))}
            <span className="ml-2 text-muted-foreground/70">· tamanho = total de focos</span>
          </div>

          {/* Treemap */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Distribuição de focos por município</CardTitle>
            </CardHeader>
            <CardContent>
              {treemapData.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
                  Nenhum foco registrado ainda
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={360}>
                  <Treemap
                    data={treemapData}
                    dataKey="size"
                    aspectRatio={4 / 3}
                    content={<TreemapContent />}
                  >
                    {treemapData.map((entry) => (
                      <Cell key={entry.name} fill={scoreToColor(entry.score)} />
                    ))}
                  </Treemap>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* SLA Distribution por município */}
          {slaBarData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Distribuição SLA por município</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={slaBarData} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="OK" stackId="a" fill="#10b981" />
                    <Bar dataKey="Atenção" stackId="a" fill="#f59e0b" />
                    <Bar dataKey="Crítico" stackId="a" fill="#f97316" />
                    <Bar dataKey="Vencido" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Tab: Alertas ─────────────────────────────────────────────────── */}
        <TabsContent value="alertas" className="mt-4">
          {alertas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 p-10 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <p className="text-base font-semibold text-emerald-700">Nenhum alerta ativo</p>
              <p className="text-sm text-muted-foreground">
                Todos os municípios estão dentro dos parâmetros operacionais esperados.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Resumo */}
              <div className="flex gap-3 flex-wrap">
                {(['critico', 'atencao', 'inativo'] as AlertaSeveridade[]).map(sev => {
                  const count = alertas.filter(a => a.severidade === sev).length;
                  if (count === 0) return null;
                  const config = {
                    critico: { label: 'Crítico', color: 'bg-red-100 text-red-800' },
                    atencao: { label: 'Atenção', color: 'bg-amber-100 text-amber-800' },
                    inativo: { label: 'Inativo', color: 'bg-slate-100 text-slate-700' },
                  };
                  return (
                    <Badge key={sev} className={`${config[sev].color} border-0 text-sm px-3 py-1`}>
                      {count} {config[sev].label}
                    </Badge>
                  );
                })}
              </div>
              {/* Cards de alerta */}
              <div className="space-y-2">
                {alertas.map((a, i) => <AlertaCard key={`${a.cliente_id}-${i}`} alerta={a} />)}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Tab: Vulnerabilidade ──────────────────────────────────────────── */}
        <TabsContent value="vulnerabilidade" className="space-y-4 mt-4">

          {vulnerabilidade.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                Nenhuma vistoria consolidada encontrada nos municípios do agrupamento.
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Tabela comparativa */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Vulnerabilidade por município</CardTitle>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Município / UF</TableHead>
                        <TableHead className="text-right">Vistorias</TableHead>
                        <TableHead className="text-right">Vuln. crítica</TableHead>
                        <TableHead className="text-right">Vuln. alta</TableHead>
                        <TableHead className="text-right">Risco vet. crítico</TableHead>
                        <TableHead className="text-right">Risco vet. alto</TableHead>
                        <TableHead className="text-right">Alerta urgente</TableHead>
                        <TableHead className="text-right">P1 / P2</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vulnerabilidade.map((row: RegionalVulnerabilidadeMunicipio) => (
                        <TableRow key={row.cliente_id}>
                          <TableCell>
                            <div className="font-medium">{row.municipio_nome}</div>
                            {row.uf && <div className="text-xs text-muted-foreground">{row.cidade} · {row.uf}</div>}
                          </TableCell>
                          <TableCell className="text-right font-mono">{fmt(row.total_vistorias)}</TableCell>
                          <TableCell className="text-right">
                            <Badge className={`border-0 ${row.vulnerabilidade_critica > 0 ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-500'}`}>
                              {fmt(row.vulnerabilidade_critica)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge className={`border-0 ${row.vulnerabilidade_alta > 0 ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-500'}`}>
                              {fmt(row.vulnerabilidade_alta)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge className={`border-0 ${row.risco_vetorial_critico > 0 ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-500'}`}>
                              {fmt(row.risco_vetorial_critico)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge className={`border-0 ${row.risco_vetorial_alto > 0 ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-500'}`}>
                              {fmt(row.risco_vetorial_alto)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge className={`border-0 ${row.alerta_saude_urgente > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>
                              {fmt(row.alerta_saude_urgente)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm font-mono">
                            <span className={row.prioridade_p1 > 0 ? 'text-red-600 font-bold' : 'text-muted-foreground'}>{row.prioridade_p1}</span>
                            <span className="text-muted-foreground mx-1">/</span>
                            <span className={row.prioridade_p2 > 0 ? 'text-orange-600' : 'text-muted-foreground'}>{row.prioridade_p2}</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Rankings */}
              <div className="grid md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500" /> Maior vulnerabilidade crítica
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-0">
                    {rankingVulnCritica.map((r: RegionalVulnerabilidadeMunicipio, i: number) => (
                      <div key={r.cliente_id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground w-5 text-center">{i + 1}</span>
                        <span className="flex-1 truncate ml-2 font-medium">{r.municipio_nome}</span>
                        <Badge className={`border-0 ${r.vulnerabilidade_critica > 0 ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-500'}`}>
                          {fmt(r.vulnerabilidade_critica)}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-orange-500" /> Maior risco vetorial
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-0">
                    {rankingRiscoVet.map((r: RegionalVulnerabilidadeMunicipio, i: number) => (
                      <div key={r.cliente_id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground w-5 text-center">{i + 1}</span>
                        <span className="flex-1 truncate ml-2 font-medium">{r.municipio_nome}</span>
                        <div className="flex items-center gap-1">
                          {r.risco_vetorial_critico > 0 && (
                            <Badge className="border-0 bg-red-100 text-red-800">{r.risco_vetorial_critico}</Badge>
                          )}
                          {r.risco_vetorial_alto > 0 && (
                            <Badge className="border-0 bg-orange-100 text-orange-800">{r.risco_vetorial_alto}</Badge>
                          )}
                          {r.risco_vetorial_critico === 0 && r.risco_vetorial_alto === 0 && (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-500" /> Maior alerta de saúde urgente
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-0">
                    {rankingAlertaSaude.map((r: RegionalVulnerabilidadeMunicipio, i: number) => (
                      <div key={r.cliente_id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground w-5 text-center">{i + 1}</span>
                        <span className="flex-1 truncate ml-2 font-medium">{r.municipio_nome}</span>
                        <Badge className={`border-0 ${r.alerta_saude_urgente > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>
                          {fmt(r.alerta_saude_urgente)}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Activity className="w-4 h-4 text-red-600" /> Maior prioridade P1
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-0">
                    {rankingP1.map((r: RegionalVulnerabilidadeMunicipio, i: number) => (
                      <div key={r.cliente_id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground w-5 text-center">{i + 1}</span>
                        <span className="flex-1 truncate ml-2 font-medium">{r.municipio_nome}</span>
                        <div className="flex items-center gap-1">
                          <Badge className={`border-0 ${r.prioridade_p1 > 0 ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-500'}`}>
                            P1: {r.prioridade_p1}
                          </Badge>
                          <Badge className="border-0 bg-orange-100 text-orange-800">
                            P2: {r.prioridade_p2}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        {/* ── Tab: Insights IA ─────────────────────────────────────────────── */}
        <TabsContent value="insights-ia" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-500" />
                    Análise Regional com IA
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Claude Haiku analisa os dados de {totais.municipios} municípios e gera um relatório estratégico
                  </p>
                </div>
                <Button
                  onClick={gerarInsights}
                  disabled={insightsLoading}
                  className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
                  size="sm"
                >
                  {insightsLoading
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analisando...</>
                    : <><Sparkles className="w-3.5 h-3.5" /> {insights ? 'Regerar análise' : 'Gerar análise'}</>
                  }
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {insightsError && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {insightsError}
                </div>
              )}

              {!insights && !insightsLoading && !insightsError && (
                <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/40 p-10 text-center space-y-2">
                  <Sparkles className="w-8 h-8 text-violet-400 mx-auto" />
                  <p className="text-sm font-medium text-violet-700">Clique em "Gerar análise" para começar</p>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    A IA vai analisar KPIs, SLA, atividade e performance de todos os municípios
                    e gerar um relatório estratégico personalizado.
                  </p>
                </div>
              )}

              {insightsLoading && (
                <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                  <p className="text-sm">Analisando dados de {totais.municipios} municípios...</p>
                </div>
              )}

              {insights && !insightsLoading && (
                <div className="space-y-3">
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 p-6">
                    <MarkdownRenderer content={insights} />
                  </div>
                  {geradoEm && (
                    <p className="text-xs text-muted-foreground text-right">
                      Gerado em {new Date(geradoEm).toLocaleString('pt-BR')} · Claude Haiku
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        {/* ── Tab: Gráficos IA ──────────────────────────────────────────────── */}
        <TabsContent value="graficos-ia" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <PieIcon className="w-4 h-4 text-violet-500" />
                    Visualizações com IA
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Claude Haiku analisa os dados e escolhe as melhores visualizações para {totais.municipios} município{totais.municipios !== 1 ? 's' : ''}
                  </p>
                </div>
                <Button
                  onClick={gerarGraficos}
                  disabled={graficosLoading}
                  className="gap-2 bg-violet-600 hover:bg-violet-700 text-white shrink-0"
                  size="sm"
                >
                  {graficosLoading
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando...</>
                    : <><Sparkles className="w-3.5 h-3.5" /> {graficos ? 'Regerar gráficos' : 'Gerar gráficos'}</>
                  }
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {graficosError && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {graficosError}
                </div>
              )}

              {!graficos && !graficosLoading && !graficosError && (
                <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/40 p-10 text-center space-y-2">
                  <PieIcon className="w-8 h-8 text-violet-400 mx-auto" />
                  <p className="text-sm font-medium text-violet-700">Clique em "Gerar gráficos" para começar</p>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    A IA vai escolher automaticamente quais gráficos melhor revelam os padrões regionais —
                    rankings, distribuição de SLA, performance e muito mais.
                  </p>
                </div>
              )}

              {graficosLoading && (
                <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                  <p className="text-sm">Analisando e escolhendo visualizações...</p>
                </div>
              )}

              {graficos && !graficosLoading && (
                <div className="space-y-4">
                  {graficosResumo && (
                    <div className="flex items-start gap-2 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800 px-4 py-3">
                      <Sparkles className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" />
                      <p className="text-sm text-violet-800 dark:text-violet-300">{graficosResumo}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {graficos.map((spec, idx) => (
                      <div key={idx} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-2">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{spec.titulo}</p>
                          {spec.descricao && (
                            <p className="text-xs text-muted-foreground mt-0.5">{spec.descricao}</p>
                          )}
                        </div>
                        <DynamicChart spec={spec} />
                      </div>
                    ))}
                  </div>

                  {graficosGeradoEm && (
                    <p className="text-xs text-muted-foreground text-right">
                      Gerado em {new Date(graficosGeradoEm).toLocaleString('pt-BR')} · Claude Haiku
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Evolução ────────────────────────────────────────────────── */}
        <TabsContent value="evolucao" className="space-y-4 mt-4">
          {loadingEvolucao ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-sm">Carregando dados regionais...</span>
            </div>
          ) : evolucao.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhum dado regional encontrado para o escopo atual.
            </div>
          ) : (
            <EvolucaoContent evolucao={evolucao} />
          )}
        </TabsContent>

        {/* ── Tab: Comparativo ─────────────────────────────────────────────── */}
        <TabsContent value="comparativo" className="space-y-4 mt-4">
          {loadingComparativo ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-sm">Carregando dados regionais...</span>
            </div>
          ) : !comparativo ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhum dado regional encontrado para o escopo atual.
            </div>
          ) : (
            <ComparativoContent data={comparativo} />
          )}
        </TabsContent>

      </Tabs>

      <MunicipioDetalheSheet
        clienteId={detalheClienteId}
        onClose={() => setDetalheClienteId(null)}
      />
    </div>
  );
}
