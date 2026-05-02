/**
 * GestorRelatorios — Tela de geração de relatórios executivos analíticos (P8.3)
 *
 * Permite selecionar período, visualizar preview e exportar PDF.
 * Usa rpc_gerar_relatorio_analitico via api.dashboardAnalitico.relatorio().
 */
import { useState, useMemo } from 'react';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/services/api';
import { gerarRelatorioAnaliticoPdf } from '@/lib/relatorioAnaliticoPdf';
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
  FileDown,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Users,
  HeartPulse,
  ShieldAlert,
  Home,
  MapPin,
} from 'lucide-react';
import { format, subDays, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VD_LABEL: Record<string, string> = {
  baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica', inconclusivo: 'Inconclusivo',
};
const AS_LABEL: Record<string, string> = {
  nenhum: 'Nenhum', atencao: 'Atenção', urgente: 'Urgente', inconclusivo: 'Inconclusivo',
};
const RO_LABEL: Record<string, string> = {
  visitado: 'Visitado', sem_acesso: 'Sem acesso (1ª)', sem_acesso_retorno: 'Sem acesso (2ª+)',
};
const RV_LABEL: Record<string, string> = {
  baixo: 'Baixo', medio: 'Médio', alto: 'Alto', critico: 'Crítico', inconclusivo: 'Inconclusivo',
};

const PRIORIDADE_COLOR: Record<string, string> = {
  P1: 'bg-red-100 text-red-700 border-red-200',
  P2: 'bg-orange-100 text-orange-700 border-orange-200',
};

function n(v: unknown): number {
  return typeof v === 'number' ? v : 0;
}

type RelatorioPayload = Record<string, unknown>;

// Preset de período
interface PeriodoPreset {
  label: string;
  inicio: string;
  fim: string;
}

function buildPresets(): PeriodoPreset[] {
  const hoje = new Date();
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
  return [
    { label: 'Últimos 7 dias',   inicio: fmt(subDays(hoje, 7)),    fim: fmt(hoje) },
    { label: 'Últimos 30 dias',  inicio: fmt(subDays(hoje, 30)),   fim: fmt(hoje) },
    { label: 'Últimos 90 dias',  inicio: fmt(subDays(hoje, 90)),   fim: fmt(hoje) },
    { label: 'Último mês',       inicio: fmt(subMonths(hoje, 1)),  fim: fmt(hoje) },
    { label: 'Últimos 6 meses',  inicio: fmt(subMonths(hoje, 6)),  fim: fmt(hoje) },
  ];
}

// ─── Subcomponentes de preview ────────────────────────────────────────────────

function KpiMini({ label, value, alarm }: { label: string; value: string | number; alarm?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${alarm ? 'border-red-300 bg-red-50 dark:bg-red-950/20' : 'bg-muted/30'}`}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold ${alarm ? 'text-red-600' : ''}`}>{value}</p>
    </div>
  );
}

function DistribRow({ label, total, max, colorClass }: { label: string; total: number; max: number; colorClass: string }) {
  const pct = max > 0 ? Math.round((total / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="text-xs w-32 shrink-0 text-muted-foreground">{label}</span>
      <div className="flex-1 h-2 bg-muted/50 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums w-16 text-right">{total} ({pct}%)</span>
    </div>
  );
}

// ─── Preview do relatório ─────────────────────────────────────────────────────

function PreviewRelatorio({ payload, onExport, exporting }: {
  payload: RelatorioPayload;
  onExport: () => void;
  exporting: boolean;
}) {
  const meta = payload.meta as Record<string, string> | undefined;
  const resumo = payload.resumo as Record<string, number | null> | undefined;
  const risco = (payload.risco_territorial as Array<Record<string, unknown>>) ?? [];
  const vuln = (payload.vulnerabilidade as Array<{ vulnerabilidade_domiciliar: string; total: number }>) ?? [];
  const alertas = (payload.alerta_saude as Array<{ alerta_saude: string; total: number }>) ?? [];
  const opResult = (payload.resultado_operacional as Array<{ resultado_operacional: string; total: number }>) ?? [];
  const criticos = (payload.imoveis_criticos as Array<Record<string, unknown>>) ?? [];

  const periodoFmt = meta
    ? `${format(new Date(meta.periodo_inicio + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })} a ${format(new Date(meta.periodo_fim + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}`
    : '—';

  const totalVuln = useMemo(() => vuln.reduce((s, v) => s + v.total, 0), [vuln]);
  const totalAS = useMemo(() => alertas.reduce((s, v) => s + v.total, 0), [alertas]);
  const totalRO = useMemo(() => opResult.reduce((s, v) => s + v.total, 0), [opResult]);

  return (
    <div className="space-y-5">
      {/* Cabeçalho do preview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Pré-visualização do relatório</p>
          <p className="font-semibold text-sm">{meta?.municipio ?? '—'}</p>
          <p className="text-xs text-muted-foreground">{periodoFmt}</p>
        </div>
        <Button onClick={onExport} disabled={exporting} className="gap-2 shrink-0">
          {exporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
          Exportar PDF
        </Button>
      </div>

      {/* KPIs */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Resumo executivo</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <KpiMini label="Total de vistorias" value={n(resumo?.total_vistorias).toLocaleString('pt-BR')} />
          <KpiMini label="Taxa de acesso" value={resumo?.taxa_acesso_pct != null ? `${resumo.taxa_acesso_pct}%` : '—'} alarm={(resumo?.taxa_acesso_pct ?? 100) < 70} />
          <KpiMini label="P1 (crítico)" value={n(resumo?.p1_count)} alarm={n(resumo?.p1_count) > 0} />
          <KpiMini label="P2 (alto)" value={n(resumo?.p2_count)} alarm={n(resumo?.p2_count) > 0} />
          <KpiMini label="Alertas urgentes" value={n(resumo?.alertas_urgentes)} alarm={n(resumo?.alertas_urgentes) > 0} />
          <KpiMini label="Vulnerabilidade alta/crítica" value={n(resumo?.vulnerabilidade_alta_count)} alarm={n(resumo?.vulnerabilidade_alta_count) > 0} />
        </div>
      </div>

      {/* Alertas de atenção */}
      {(n(resumo?.p1_count) > 0 || n(resumo?.alertas_urgentes) > 0) && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 px-4 py-3 space-y-1">
          <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Pontos de atenção
          </p>
          {n(resumo?.p1_count) > 0 && <p className="text-xs text-red-600">• {resumo?.p1_count} imóvel(is) em situação crítica exigem intervenção imediata.</p>}
          {n(resumo?.alertas_urgentes) > 0 && <p className="text-xs text-red-600">• {resumo?.alertas_urgentes} domicílio(s) com sinais de dengue em ≥50% dos moradores.</p>}
          {(resumo?.taxa_acesso_pct ?? 100) < 70 && <p className="text-xs text-red-600">• Taxa de acesso abaixo de 70% — revisar estratégia de campo.</p>}
        </div>
      )}

      {/* Risco territorial */}
      {risco.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> Situação por bairro
          </p>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2 font-medium">Bairro</th>
                  <th className="text-center p-2 font-medium">Vistorias</th>
                  <th className="text-center p-2 font-medium">P1+P2</th>
                  <th className="text-center p-2 font-medium">Vetorial ↑</th>
                  <th className="text-center p-2 font-medium">Alertas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {risco.slice(0, 10).map((r, i) => (
                  <tr key={i} className="hover:bg-muted/20">
                    <td className="p-2 font-medium truncate max-w-[140px]">{String(r.bairro)}</td>
                    <td className="p-2 text-center tabular-nums">{String(r.total_vistorias)}</td>
                    <td className={`p-2 text-center tabular-nums font-medium ${n(r.criticos_count as number) > 0 ? 'text-red-600' : ''}`}>{String(r.criticos_count)}</td>
                    <td className={`p-2 text-center tabular-nums ${n(r.risco_vetorial_alto as number) > 0 ? 'text-orange-600' : ''}`}>{String(r.risco_vetorial_alto)}</td>
                    <td className={`p-2 text-center tabular-nums ${n(r.alertas_saude as number) > 0 ? 'text-yellow-600' : ''}`}>{String(r.alertas_saude)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {risco.length > 10 && <p className="text-[10px] text-muted-foreground mt-1">+{risco.length - 10} bairros no PDF completo</p>}
        </div>
      )}

      {/* Distribuições */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Vulnerabilidade */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> Vulnerabilidade
          </p>
          <div className="space-y-1">
            {vuln.map((v, i) => (
              <DistribRow
                key={i}
                label={VD_LABEL[v.vulnerabilidade_domiciliar] ?? v.vulnerabilidade_domiciliar}
                total={v.total}
                max={totalVuln}
                colorClass={v.vulnerabilidade_domiciliar === 'critica' ? 'bg-red-500' : v.vulnerabilidade_domiciliar === 'alta' ? 'bg-orange-500' : v.vulnerabilidade_domiciliar === 'media' ? 'bg-yellow-500' : 'bg-green-500'}
              />
            ))}
            {vuln.length === 0 && <p className="text-xs text-muted-foreground">Sem dados</p>}
          </div>
        </div>

        {/* Alertas */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <HeartPulse className="h-3.5 w-3.5" /> Alertas de saúde
          </p>
          <div className="space-y-1">
            {alertas.map((v, i) => (
              <DistribRow
                key={i}
                label={AS_LABEL[v.alerta_saude] ?? v.alerta_saude}
                total={v.total}
                max={totalAS}
                colorClass={v.alerta_saude === 'urgente' ? 'bg-red-500' : v.alerta_saude === 'atencao' ? 'bg-yellow-500' : 'bg-green-500'}
              />
            ))}
            {alertas.length === 0 && <p className="text-xs text-muted-foreground">Sem dados</p>}
          </div>
        </div>

        {/* Operacional */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Home className="h-3.5 w-3.5" /> Resultado operacional
          </p>
          <div className="space-y-1">
            {opResult.map((v, i) => (
              <DistribRow
                key={i}
                label={RO_LABEL[v.resultado_operacional] ?? v.resultado_operacional}
                total={v.total}
                max={totalRO}
                colorClass={v.resultado_operacional === 'visitado' ? 'bg-green-500' : v.resultado_operacional === 'sem_acesso_retorno' ? 'bg-orange-500' : 'bg-yellow-500'}
              />
            ))}
            {opResult.length === 0 && <p className="text-xs text-muted-foreground">Sem dados</p>}
          </div>
        </div>
      </div>

      {/* Imóveis críticos */}
      {criticos.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 text-red-500" /> Imóveis críticos (P1/P2) — {criticos.length} encontrados
          </p>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2 font-medium">Endereço</th>
                  <th className="text-center p-2 font-medium">Prior.</th>
                  <th className="text-center p-2 font-medium">Vetorial</th>
                  <th className="text-center p-2 font-medium">Vulnerab.</th>
                  <th className="text-center p-2 font-medium">Saúde</th>
                  <th className="text-center p-2 font-medium">Acesso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {criticos.slice(0, 15).map((im, i) => (
                  <tr key={i} className="hover:bg-muted/20">
                    <td className="p-2">
                      <div className="font-medium truncate max-w-[140px]">{[im.logradouro, im.numero].filter(Boolean).join(', ') || '—'}</div>
                      <div className="text-muted-foreground">{String(im.bairro)}</div>
                    </td>
                    <td className="p-2 text-center">
                      <Badge variant="outline" className={`text-[10px] px-1 ${PRIORIDADE_COLOR[String(im.prioridade_final)] ?? ''}`}>
                        {String(im.prioridade_final ?? '—')}
                      </Badge>
                    </td>
                    <td className={`p-2 text-center ${['alto','critico'].includes(String(im.risco_vetorial)) ? 'text-orange-600 font-semibold' : 'text-muted-foreground'}`}>
                      {RV_LABEL[String(im.risco_vetorial ?? '')] ?? '—'}
                    </td>
                    <td className={`p-2 text-center ${['alta','critica'].includes(String(im.vulnerabilidade_domiciliar)) ? 'text-orange-600 font-semibold' : 'text-muted-foreground'}`}>
                      {VD_LABEL[String(im.vulnerabilidade_domiciliar ?? '')] ?? '—'}
                    </td>
                    <td className={`p-2 text-center ${im.alerta_saude === 'urgente' ? 'text-red-600 font-bold' : im.alerta_saude === 'atencao' ? 'text-yellow-600' : 'text-muted-foreground'}`}>
                      {AS_LABEL[String(im.alerta_saude ?? '')] ?? '—'}
                    </td>
                    <td className="p-2 text-center text-muted-foreground">
                      {im.resultado_operacional === 'visitado'
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 inline" />
                        : <XCircle className="h-3.5 w-3.5 text-amber-500 inline" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {criticos.length > 15 && <p className="text-[10px] text-muted-foreground mt-1">+{criticos.length - 15} imóveis no PDF completo</p>}
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function GestorRelatorios() {
  const { clienteId, loading: clienteLoading, clientes, setClienteId } = useClienteAtivo();
  const { isAnalistaRegional } = useAuth();
  const presets = useMemo(() => buildPresets(), []);

  const [presetIdx, setPresetIdx] = useState<string>('1'); // 30 dias
  const [payload, setPayload] = useState<RelatorioPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preset = presets[Number(presetIdx)] ?? presets[1];

  async function gerarRelatorio() {
    if (!clienteId) return;
    setLoading(true);
    setError(null);
    setPayload(null);
    try {
      const data = await api.dashboardAnalitico.relatorio(clienteId, preset.inicio, preset.fim);
      setPayload(data);
      // Salvar no histórico (fire-and-forget — não bloqueia a UI)
      api.dashboardAnalitico.salvarRelatorio({
        clienteId,
        periodoInicio: preset.inicio,
        periodoFim:    preset.fim,
        payload:       data,
      }).catch(() => { /* não crítico */ });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar relatório');
    } finally {
      setLoading(false);
    }
  }

  async function exportarPdf() {
    if (!payload) return;
    setExporting(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      gerarRelatorioAnaliticoPdf(payload as any);
    } finally {
      setTimeout(() => setExporting(false), 1000);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold">Relatórios Executivos</h1>
        <p className="text-sm text-muted-foreground">
          Gere relatórios analíticos prontos para apresentação e exportação em PDF
        </p>
      </div>

      {/* Painel de geração */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Configurar relatório</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            {isAnalistaRegional && clientes.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Município</label>
                <Select value={clienteId ?? ''} onValueChange={setClienteId}>
                  <SelectTrigger className="w-full sm:w-[220px]">
                    <SelectValue placeholder="Selecionar município..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Período</label>
              <Select value={presetIdx} onValueChange={setPresetIdx}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {presets.map((p, i) => (
                    <SelectItem key={i} value={String(i)}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={gerarRelatorio} disabled={loading || clienteLoading || !clienteId} className="gap-2 shrink-0">
              {(loading || clienteLoading) ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {loading ? 'Gerando...' : 'Gerar relatório'}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {format(new Date(preset.inicio + 'T00:00:00'), "dd 'de' MMMM", { locale: ptBR })} a {format(new Date(preset.fim + 'T00:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>

          {!clienteLoading && !clienteId && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 px-3 py-2">
              <p className="text-xs text-yellow-700 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Conta sem município vinculado. Contate o administrador do sistema.
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 px-3 py-2">
              <p className="text-xs text-red-600 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> {error}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Skeleton enquanto carrega */}
      {loading && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-24 rounded-lg" />
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      {payload && !loading && (
        <Card>
          <CardContent className="pt-6">
            <PreviewRelatorio payload={payload} onExport={exportarPdf} exporting={exporting} />
          </CardContent>
        </Card>
      )}

      {/* Estado inicial */}
      {!payload && !loading && !error && (
        <div className="text-center py-16 text-muted-foreground">
          <FileDown className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Selecione o período e clique em "Gerar relatório" para visualizar e exportar.</p>
        </div>
      )}
    </div>
  );
}
