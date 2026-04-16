/**
 * DashboardAnalitico — Dashboard Analítico Estratégico (P8.2 + P7.13B)
 *
 * Visão macro da consolidação avançada de vistoria por bairro/território.
 * Público: supervisor, admin, analista_regional.
 */
import { useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useResumoAnalitico,
  useRiscoTerritorial,
  useVulnerabilidadeDistrib,
  useAlertaSaudeDistrib,
  useResultadoOperacionalDistrib,
  useImoveisCriticos,
  useBairrosDashboard,
  type DashboardRiscoTerritorial,
  type DashboardImovelCritico,
} from '@/hooks/queries/useDashboardAnalitico';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  Activity,
  Home,
  HeartPulse,
  ShieldAlert,
  Users,
  MapPin,
  CheckCircle2,
  XCircle,
  FileDown,
  Info,
  BookOpen,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORIDADE_COLOR: Record<string, string> = {
  P1: 'bg-red-100 text-red-700 border-red-200',
  P2: 'bg-orange-100 text-orange-700 border-orange-200',
  P3: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  P4: 'bg-blue-100 text-blue-700 border-blue-200',
};

const VD_COLOR: Record<string, string> = {
  baixa: 'text-green-700',
  media: 'text-yellow-700',
  alta: 'text-orange-700 font-semibold',
  critica: 'text-red-700 font-bold',
  inconclusivo: 'text-gray-500',
};

const AS_COLOR: Record<string, string> = {
  nenhum: 'text-green-700',
  atencao: 'text-yellow-700 font-semibold',
  urgente: 'text-red-700 font-bold',
  inconclusivo: 'text-gray-500',
};

const RV_COLOR: Record<string, string> = {
  baixo: 'text-green-700',
  medio: 'text-yellow-700',
  alto: 'text-orange-700 font-semibold',
  critico: 'text-red-700 font-bold',
  inconclusivo: 'text-gray-500',
};

const VD_LABEL: Record<string, string> = {
  baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica', inconclusivo: 'Inconclusivo',
};
const AS_LABEL: Record<string, string> = {
  nenhum: 'Nenhum', atencao: 'Atenção', urgente: 'Urgente', inconclusivo: 'Inconclusivo',
};
const RO_LABEL: Record<string, string> = {
  visitado: 'Visitado', sem_acesso: 'Sem acesso (1ª tentativa)', sem_acesso_retorno: 'Sem acesso (2ª+ tentativa)',
};
const RV_LABEL: Record<string, string> = {
  baixo: 'Baixo', medio: 'Médio', alto: 'Alto', critico: 'Crítico', inconclusivo: 'Inconclusivo',
};

const BAR_COLORS = ['#16a34a', '#ca8a04', '#ea580c', '#dc2626', '#9ca3af'];

function num(v: number | null | undefined) {
  return v ?? 0;
}

function pct(v: number | null | undefined) {
  return v != null ? `${v}%` : '—';
}

// ─── Subcomponentes ──────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  alarm,
  tooltip,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  alarm?: boolean;
  tooltip?: string;
}) {
  return (
    <Card className={alarm ? 'border-red-300 dark:border-red-800' : ''}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 mb-0.5">
              <p className="text-xs text-muted-foreground">{label}</p>
              {tooltip && (
                <span title={tooltip} className="cursor-help text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                  <Info className="h-3 w-3" />
                </span>
              )}
            </div>
            <p className={`text-2xl font-bold ${alarm ? 'text-red-600' : ''}`}>{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <Icon className={`h-5 w-5 mt-1 shrink-0 ${alarm ? 'text-red-500' : 'text-muted-foreground'}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function SemaforoCell({ value }: { value: number }) {
  if (value === 0) return <span className="text-green-600 text-xs">0</span>;
  if (value <= 2) return <span className="text-yellow-600 text-xs font-medium">{value}</span>;
  return <span className="text-red-600 text-xs font-bold">{value}</span>;
}

function DistribBars({
  data,
  valueKey,
  labelMap,
}: {
  data: { [k: string]: string | number }[];
  valueKey: string;
  labelMap: Record<string, string>;
}) {
  const total = data.reduce((s, d) => s + Number(d[valueKey] ?? 0), 0);
  if (total === 0) return <p className="text-xs text-muted-foreground">Sem dados registrados</p>;

  return (
    <ResponsiveContainer width="100%" height={Math.max(80, data.length * 28)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 40, top: 4, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey={valueKey === 'total' ? undefined : valueKey}
          tickFormatter={(v: string) => labelMap[v] ?? v}
          width={90}
          tick={{ fontSize: 11 }}
        />
        <Tooltip
          formatter={(v: number) => [`${v} (${Math.round((v / total) * 100)}%)`, 'Total']}
          labelFormatter={(l: string) => labelMap[l] ?? l}
        />
        <Bar dataKey="total" radius={[0, 3, 3, 0]}>
          {data.map((_entry, i) => (
            <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Bloco "Como interpretar" ─────────────────────────────────────────────────

function ComoInterpretar() {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="rounded-xl border border-blue-200/60 dark:border-blue-800/30 bg-blue-50/50 dark:bg-blue-950/10 px-4 py-3">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-2 text-left"
        onClick={() => setAberto((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
            Como interpretar este painel
          </span>
        </div>
        <span className="text-xs text-blue-500 dark:text-blue-400 shrink-0">
          {aberto ? 'Ocultar' : 'Ver explicação'}
        </span>
      </button>

      {aberto && (
        <div className="mt-3 pt-3 border-t border-blue-200/50 dark:border-blue-800/30">
          <p className="text-xs text-muted-foreground mb-3">
            Este painel mostra um resumo das vistorias registradas pelas equipes de campo,
            agrupadas por bairro e dimensão de risco. Os dados refletem o que foi observado
            e consolidado nas vistorias realizadas — não são estimativas.
          </p>
          <ul className="space-y-2 text-xs">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-4 w-4 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-[9px] font-bold shrink-0">P1</span>
              <span><strong>Alta prioridade (P1 e P2)</strong> — imóveis com maior risco identificado nas vistorias. Exigem ação imediata ou retorno urgente das equipes.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-4 w-4 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center shrink-0"><AlertTriangle className="h-2.5 w-2.5" /></span>
              <span><strong>Risco vetorial alto</strong> — imóveis onde foram identificados criadouros ou condições favoráveis à proliferação do mosquito.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-4 w-4 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center shrink-0"><Users className="h-2.5 w-2.5" /></span>
              <span><strong>Vulnerabilidade alta</strong> — imóveis com fragilidade social, estrutural ou ambiental elevada, que precisam de atenção especial das equipes.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-4 w-4 rounded-full bg-red-100 text-red-700 flex items-center justify-center shrink-0"><HeartPulse className="h-2.5 w-2.5" /></span>
              <span><strong>Alerta de saúde</strong> — imóveis com indícios de moradores com sintomas relevantes, sinalizados pelas equipes durante a vistoria.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 h-4 w-4 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center shrink-0"><XCircle className="h-2.5 w-2.5" /></span>
              <span><strong>Imóveis sem acesso</strong> — locais onde a equipe não conseguiu entrar. Precisam de nova tentativa de visita.</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Tabela de risco territorial ─────────────────────────────────────────────

function RiscoTerritorialTabela({
  rows,
  onBairroClick,
}: {
  rows: DashboardRiscoTerritorial[];
  onBairroClick: (bairro: string) => void;
}) {
  if (rows.length === 0)
    return <p className="text-xs text-muted-foreground py-4 text-center">Sem dados disponíveis</p>;

  return (
    <div className="overflow-x-auto">
      <p className="text-[11px] text-muted-foreground mb-2">
        Clique em um bairro para filtrar os imóveis de alta prioridade abaixo.
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="text-left py-2 pr-3 font-medium">Bairro</th>
            <th className="text-right py-2 px-2 font-medium">Vistorias</th>
            <th className="text-right py-2 px-2 font-medium">Alta prioridade</th>
            <th className="text-right py-2 px-2 font-medium">Risco vetorial alto</th>
            <th className="text-right py-2 px-2 font-medium">Vulnerabilidade alta</th>
            <th className="text-right py-2 px-2 font-medium">Alerta saúde</th>
            <th className="text-right py-2 pl-2 font-medium">Sem acesso</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {rows.map((r) => (
            <tr
              key={r.bairro}
              className="hover:bg-muted/40 transition-colors cursor-pointer"
              onClick={() => onBairroClick(r.bairro)}
              title={`Filtrar por ${r.bairro}`}
            >
              <td className="py-1.5 pr-3 font-medium max-w-[140px] truncate text-blue-700 dark:text-blue-400 underline-offset-2 hover:underline" title={r.bairro}>
                {r.bairro}
              </td>
              <td className="text-right py-1.5 px-2 tabular-nums">{r.total_vistorias}</td>
              <td className="text-right py-1.5 px-2 tabular-nums">
                <SemaforoCell value={r.criticos_count} />
                {r.pct_criticos != null && (
                  <span className="text-muted-foreground ml-1">({r.pct_criticos}%)</span>
                )}
              </td>
              <td className="text-right py-1.5 px-2 tabular-nums">
                <SemaforoCell value={r.risco_vetorial_alto} />
              </td>
              <td className="text-right py-1.5 px-2 tabular-nums">
                <SemaforoCell value={r.vulnerabilidade_alta} />
              </td>
              <td className="text-right py-1.5 px-2 tabular-nums">
                <SemaforoCell value={r.alertas_saude} />
              </td>
              <td className="text-right py-1.5 pl-2 tabular-nums">
                <SemaforoCell value={r.sem_acesso_total} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Tabela de imóveis críticos ───────────────────────────────────────────────

function ImoveisCriticosTabela({ rows }: { rows: DashboardImovelCritico[] }) {
  if (rows.length === 0)
    return (
      <p className="text-xs text-muted-foreground py-4 text-center">
        Nenhum imóvel de alta prioridade encontrado para os filtros selecionados
      </p>
    );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="text-left py-2 pr-3 font-medium">Imóvel / Bairro</th>
            <th className="text-center py-2 px-2 font-medium">Prioridade</th>
            <th className="text-center py-2 px-2 font-medium">Risco vetorial</th>
            <th className="text-center py-2 px-2 font-medium">Vulnerabilidade</th>
            <th className="text-center py-2 px-2 font-medium">Alerta saúde</th>
            <th className="text-center py-2 px-2 font-medium">Acesso</th>
            <th className="text-right py-2 pl-2 font-medium">Vistoria</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {rows.map((r) => (
            <tr key={r.vistoria_id} className="hover:bg-muted/30 transition-colors">
              <td className="py-1.5 pr-3">
                <div className="font-medium truncate max-w-[160px]" title={`${r.logradouro ?? ''} ${r.numero ?? ''}`}>
                  {r.logradouro ?? '—'} {r.numero}
                </div>
                <div className="text-muted-foreground truncate max-w-[160px]">{r.bairro}</div>
              </td>
              <td className="text-center py-1.5 px-2">
                {r.prioridade_final ? (
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 ${PRIORIDADE_COLOR[r.prioridade_final] ?? ''}`}
                  >
                    {r.prioridade_final}
                  </Badge>
                ) : (
                  '—'
                )}
              </td>
              <td className={`text-center py-1.5 px-2 ${RV_COLOR[r.risco_vetorial ?? ''] ?? ''}`}>
                {RV_LABEL[r.risco_vetorial ?? ''] ?? '—'}
              </td>
              <td className={`text-center py-1.5 px-2 ${VD_COLOR[r.vulnerabilidade_domiciliar ?? ''] ?? ''}`}>
                {VD_LABEL[r.vulnerabilidade_domiciliar ?? ''] ?? '—'}
              </td>
              <td className={`text-center py-1.5 px-2 ${AS_COLOR[r.alerta_saude ?? ''] ?? ''}`}>
                {AS_LABEL[r.alerta_saude ?? ''] ?? '—'}
              </td>
              <td className="text-center py-1.5 px-2 text-muted-foreground">
                {r.resultado_operacional === 'visitado' ? (
                  <span className="flex items-center justify-center gap-1 text-green-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Visitado</span>
                  </span>
                ) : r.resultado_operacional ? (
                  <span className="flex items-center justify-center gap-1 text-amber-600">
                    <XCircle className="h-3.5 w-3.5" />
                    <span>Sem acesso</span>
                  </span>
                ) : (
                  '—'
                )}
              </td>
              <td className="text-right py-1.5 pl-2 text-muted-foreground whitespace-nowrap">
                {format(new Date(r.data_visita), 'dd/MM', { locale: ptBR })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function DashboardAnalitico() {
  const navigate = useNavigate();
  const [bairroFilter, setBairroFilter] = useState<string>('all');
  const [prioridadeFilter, setPrioridadeFilter] = useState<string>('all');
  const criticosRef = useRef<HTMLDivElement>(null);

  const { data: resumo, isLoading: loadingResumo } = useResumoAnalitico();
  const bairroParam = bairroFilter === 'all' ? undefined : bairroFilter;
  const prioridadeParam = prioridadeFilter === 'all' ? undefined : prioridadeFilter;
  const { data: risco = [], isLoading: loadingRisco } = useRiscoTerritorial(bairroParam);
  const { data: vulnerabilidade = [], isLoading: loadingVuln } = useVulnerabilidadeDistrib(bairroParam);
  const { data: alertas = [], isLoading: loadingAlertas } = useAlertaSaudeDistrib(bairroParam);
  const { data: operacional = [], isLoading: loadingOp } = useResultadoOperacionalDistrib(bairroParam);
  const { data: criticos = [], isLoading: loadingCriticos } = useImoveisCriticos(
    bairroParam,
    prioridadeParam,
  );
  const { data: bairros = [] } = useBairrosDashboard();

  const vulnAgregada = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of vulnerabilidade) {
      if (r.vulnerabilidade_domiciliar) {
        map[r.vulnerabilidade_domiciliar] = (map[r.vulnerabilidade_domiciliar] ?? 0) + r.total;
      }
    }
    return Object.entries(map)
      .map(([vulnerabilidade_domiciliar, total]) => ({ vulnerabilidade_domiciliar, total }))
      .sort((a, b) => b.total - a.total);
  }, [vulnerabilidade]);

  const alertasAgregados = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of alertas) {
      if (r.alerta_saude) map[r.alerta_saude] = (map[r.alerta_saude] ?? 0) + r.total;
    }
    return Object.entries(map)
      .map(([alerta_saude, total]) => ({ alerta_saude, total }))
      .sort((a, b) => b.total - a.total);
  }, [alertas]);

  const opAgregado = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of operacional) {
      if (r.resultado_operacional) map[r.resultado_operacional] = (map[r.resultado_operacional] ?? 0) + r.total;
    }
    return Object.entries(map)
      .map(([resultado_operacional, total]) => ({ resultado_operacional, total }))
      .sort((a, b) => b.total - a.total);
  }, [operacional]);

  function handleBairroClick(bairro: string) {
    setBairroFilter(bairro);
    setTimeout(() => {
      criticosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Painel Analítico de Vistorias</h1>
          <p className="text-sm text-muted-foreground">
            Resumo por bairro das vistorias realizadas pelas equipes de campo
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate('/gestor/relatorios')}>
            <FileDown className="h-3.5 w-3.5" />
            Gerar relatório
          </Button>
          {/* Filtro de bairro */}
          <Select value={bairroFilter} onValueChange={setBairroFilter}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue placeholder="Todos os bairros" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os bairros</SelectItem>
              {bairros.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Filtro de prioridade (só afeta tabela de críticos) */}
          <Select value={prioridadeFilter} onValueChange={setPrioridadeFilter}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue placeholder="Todas prioridades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">P1 e P2</SelectItem>
              <SelectItem value="P1">Somente P1 (Crítico)</SelectItem>
              <SelectItem value="P2">Somente P2 (Alto)</SelectItem>
            </SelectContent>
          </Select>
          {bairroFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setBairroFilter('all')}
              className="text-xs text-muted-foreground underline hover:text-foreground transition-colors"
            >
              Limpar filtro
            </button>
          )}
        </div>
      </div>

      {/* ── Como interpretar ───────────────────────────────────────────────── */}
      <ComoInterpretar />

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      {loadingResumo ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="Vistorias realizadas"
            value={num(resumo?.total_vistorias).toLocaleString('pt-BR')}
            sub={`${pct(resumo?.taxa_acesso_pct)} com acesso ao imóvel`}
            icon={Home}
            tooltip="Total de imóveis vistoriados com consolidação registrada no sistema."
          />
          <KpiCard
            label="Alta prioridade (P1 e P2)"
            value={num(resumo?.p1_count) + num(resumo?.p2_count)}
            sub={`Crítico (P1): ${num(resumo?.p1_count)} · Alto (P2): ${num(resumo?.p2_count)}`}
            icon={ShieldAlert}
            alarm={(num(resumo?.p1_count) + num(resumo?.p2_count)) > 0}
            tooltip="Imóveis com maior risco identificado nas vistorias. P1 = crítico (ação imediata). P2 = alto (ação urgente)."
          />
          <KpiCard
            label="Alertas de saúde urgentes"
            value={num(resumo?.alertas_urgentes)}
            sub="Moradores com sintomas identificados na vistoria"
            icon={HeartPulse}
            alarm={num(resumo?.alertas_urgentes) > 0}
            tooltip="Imóveis onde as equipes identificaram moradores com sintomas relevantes durante a vistoria. Sinalizam atenção da vigilância epidemiológica."
          />
          <KpiCard
            label="Vulnerabilidade alta ou crítica"
            value={num(resumo?.vulnerabilidade_alta_count)}
            sub={`Risco vetorial alto: ${num(resumo?.risco_vetorial_alto_count)} imóveis`}
            icon={Users}
            alarm={num(resumo?.vulnerabilidade_alta_count) > 0}
            tooltip="Imóveis com fragilidade social, estrutural ou ambiental elevada, que exigem atenção especial das equipes no retorno."
          />
        </div>
      )}

      {/* ── Risco territorial por bairro ────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            Situação por bairro
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingRisco ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-6 rounded" />)}
            </div>
          ) : (
            <RiscoTerritorialTabela rows={risco} onBairroClick={handleBairroClick} />
          )}
        </CardContent>
      </Card>

      {/* ── Distribuições ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Vulnerabilidade */}
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Vulnerabilidade dos imóveis
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">Fragilidade social e ambiental identificada</p>
          </CardHeader>
          <CardContent>
            {loadingVuln ? (
              <Skeleton className="h-24 rounded" />
            ) : (
              <DistribBars
                data={vulnAgregada as { [k: string]: string | number }[]}
                valueKey="total"
                labelMap={VD_LABEL}
              />
            )}
          </CardContent>
        </Card>

        {/* Alertas de saúde */}
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm flex items-center gap-2">
              <HeartPulse className="h-4 w-4 text-muted-foreground" />
              Alertas de saúde
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">Sintomas observados pelos agentes</p>
          </CardHeader>
          <CardContent>
            {loadingAlertas ? (
              <Skeleton className="h-24 rounded" />
            ) : (
              <DistribBars
                data={alertasAgregados as { [k: string]: string | number }[]}
                valueKey="total"
                labelMap={AS_LABEL}
              />
            )}
          </CardContent>
        </Card>

        {/* Resultado operacional */}
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Acesso aos imóveis
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">Resultado das tentativas de visita</p>
          </CardHeader>
          <CardContent>
            {loadingOp ? (
              <Skeleton className="h-24 rounded" />
            ) : (
              <DistribBars
                data={opAgregado as { [k: string]: string | number }[]}
                valueKey="total"
                labelMap={RO_LABEL}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Imóveis de alta prioridade ─────────────────────────────────────── */}
      <div ref={criticosRef}>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Imóveis de alta prioridade (P1 e P2)
                {criticos.length > 0 && (
                  <Badge variant="destructive" className="text-[10px] ml-1">
                    {criticos.length}
                  </Badge>
                )}
              </CardTitle>
              {bairroFilter !== 'all' && (
                <span className="text-[11px] text-muted-foreground">
                  Filtrado: <strong>{bairroFilter}</strong>
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Imóveis que exigem retorno ou ação prioritária das equipes de campo
            </p>
          </CardHeader>
          <CardContent>
            {loadingCriticos ? (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-8 rounded" />)}
              </div>
            ) : (
              <ImoveisCriticosTabela rows={criticos} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Rodapé informativo ────────────────────────────────────────────── */}
      <div className="rounded-lg border border-border/50 bg-muted/20 px-4 py-3 text-center">
        <p className="text-[11px] text-muted-foreground">
          Painel baseado nas vistorias registradas e consolidadas no sistema.
          Os dados refletem a operação realizada pelas equipes em campo e são atualizados conforme novas vistorias são registradas.
        </p>
      </div>

    </div>
  );
}
