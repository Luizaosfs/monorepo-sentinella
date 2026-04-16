import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertTriangle, Clock, MapPin, Users, Radio, RefreshCw,
  LayoutDashboard, ArrowRight, TrendingUp, MessageSquare,
  Stethoscope, ChevronRight, GitMerge, FileText, Info, MapPinOff, ClipboardCheck,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { STALE } from '@/lib/queryConfig';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScoreBadge } from '@/components/foco/ScoreBadge';
import { AgentesHojeWidget } from '@/components/dashboard/AgentesHojeWidget';
import { ResumoIAWidget } from '@/components/dashboard/ResumoIAWidget';
import { PainelPilotoFunilCard } from '@/components/dashboard/PainelPilotoFunil';
import { useCentralKpis, useImoveisParaHoje } from '@/hooks/queries/useCentralOperacional';
import { gerarRelatorioPdf } from '@/lib/gestorRelatorioPdf';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { useCasosCruzadosHoje } from '@/hooks/queries/useCasosNotificados';
import { useScoreTopCriticos, COR_SCORE, LABEL_SCORE } from '@/hooks/queries/useScoreTerritorial';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { logEvento } from '@/lib/pilotoEventos';
import { cn } from '@/lib/utils';
import { useSlaInteligente } from '@/hooks/queries/useSlaInteligente';
import {
  LABEL_STATUS_SLA_INT, LABEL_FASE_SLA, COR_STATUS_SLA_INT, formatarTempoMin,
  PRIORIDADE_SLA_INT, type SlaInteligenteStatus, type FaseSla,
} from '@/lib/slaInteligenteVisual';
import { useVistoriasConsolidadas } from '@/hooks/queries/useVistorias';
import { DimensoesBadges } from '@/components/consolidacao/DimensoesBadges';
import { PrioridadeBadge as PrioridadeConsolidacaoBadge } from '@/components/consolidacao/PrioridadeBadge';

const SCORE_CLASSES = [
  { key: 'baixo',      label: 'Baixo',      color: '#10b981' },
  { key: 'medio',      label: 'Médio',      color: '#f59e0b' },
  { key: 'alto',       label: 'Alto',       color: '#f97316' },
  { key: 'muito_alto', label: 'Muito Alto', color: '#ef4444' },
  { key: 'critico',    label: 'Crítico',    color: '#b91c1c' },
];

function KpiCard({
  title, value, subtitle, icon: Icon, color, onClick, loading, urgent,
}: {
  title: string;
  value: number | null | undefined;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  onClick?: () => void;
  loading?: boolean;
  urgent?: boolean;
}) {
  return (
    <Card
      className={cn(
        'border-border/60 transition-all',
        onClick && 'cursor-pointer hover:shadow-md hover:border-primary/30',
        urgent && value && value > 0 && 'border-red-300 bg-red-50/50 dark:bg-red-950/20',
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
          <Icon className={cn('h-4 w-4 shrink-0', color)} />
        </div>
        {loading ? (
          <Skeleton className="h-8 w-16 mt-2" />
        ) : (
          <div className="mt-2">
            <span className={cn('text-3xl font-bold tabular-nums', urgent && value && value > 0 ? 'text-red-600' : 'text-foreground')}>
              {value ?? 0}
            </span>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
        )}
        {onClick && (
          <p className="text-[10px] text-muted-foreground/60 mt-2 flex items-center gap-0.5">
            Ver detalhes <ArrowRight className="w-3 h-3" />
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function CentralOperacional() {
  const navigate = useNavigate();
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [pdfLoading, setPdfLoading] = useState(false);
  const { clienteAtivo } = useClienteAtivo();

  useEffect(() => {
    if (clienteAtivo?.id) logEvento('dashboard_aberto', clienteAtivo.id);
  }, [clienteAtivo?.id]);

  const { data: kpis, isLoading: kpisLoading, refetch } = useCentralKpis();
  const { data: imoveisParaHoje = [], isLoading: imoveisLoading } = useImoveisParaHoje(15);
  const { data: topCriticos = [] } = useScoreTopCriticos(5);
  const { data: casosCruzados = 0 } = useCasosCruzadosHoje();
  const { data: slaInteligenteList = [] } = useSlaInteligente();

  // ── Filtros vistorias consolidadas ─────────────────────────────────────────
  const [filtroVstPrioridade, setFiltroVstPrioridade] = useState<'' | 'P1' | 'P2' | 'P3+'>('');
  const [filtroVstIncompleto, setFiltroVstIncompleto] = useState(false);
  const vstFiltros = {
    prioridade: filtroVstPrioridade === 'P1'  ? (['P1'] as const)
              : filtroVstPrioridade === 'P2'  ? (['P2'] as const)
              : filtroVstPrioridade === 'P3+' ? (['P3', 'P4', 'P5'] as const)
              : undefined,
    consolidacao_incompleta: filtroVstIncompleto || undefined,
  };
  const { data: vistoriasConsolidadas = [], isLoading: vstLoading } =
    useVistoriasConsolidadas(clienteAtivo?.id, vstFiltros);

  // G4: Regiões sem cobertura hoje
  const { data: regioesSemCobertura = [] } = useQuery<{ id: string; regiao: string }[]>({
    queryKey: ['regioes-sem-cobertura', clienteAtivo?.id],
    queryFn: async () => {
      if (!clienteAtivo?.id) return [];
      const hoje = new Date().toISOString().split('T')[0];
      const { data: regioes } = await supabase
        .from('regioes')
        .select('id, regiao')
        .eq('cliente_id', clienteAtivo.id)
        .is('deleted_at', null);
      if (!regioes || regioes.length === 0) return [];
      const { data: vistoriasHoje } = await supabase
        .from('vistorias')
        .select('imovel:imoveis!inner(regiao_id)')
        .eq('cliente_id', clienteAtivo.id)
        .gte('created_at', hoje);
      const comAtividade = new Set(
        (vistoriasHoje ?? []).map((v: { imovel: { regiao_id: string } | null }) => v.imovel?.regiao_id).filter(Boolean),
      );
      return regioes.filter((r) => !comAtividade.has(r.id));
    },
    enabled: !!clienteAtivo?.id,
    staleTime: STALE.MEDIUM,
  });

  const handleRefresh = () => {
    refetch();
    setLastRefresh(new Date());
  };

  const handleGerarPdf = () => {
    setPdfLoading(true);
    setTimeout(() => {
      gerarRelatorioPdf(kpis, imoveisParaHoje, clienteAtivo?.nome);
      setPdfLoading(false);
    }, 100);
  };

  // Dados para o gráfico de distribuição de score
  const scoreDistribuicao = SCORE_CLASSES.map((sc) => ({
    ...sc,
    count: topCriticos.filter((t: { classificacao: string }) => t.classificacao === sc.key).length,
  }));

  // SLA Inteligente — contagens e top 5
  const slaIntVencidos  = slaInteligenteList.filter((f) => f.status_sla_inteligente === 'vencido').length;
  const slaIntCriticos  = slaInteligenteList.filter((f) => f.status_sla_inteligente === 'critico').length;
  const slaIntAtencao   = slaInteligenteList.filter((f) => f.status_sla_inteligente === 'atencao').length;
  const slaIntTop5 = [...slaInteligenteList]
    .filter((f) => f.status_sla_inteligente && ['vencido', 'critico', 'atencao'].includes(f.status_sla_inteligente))
    .sort((a, b) =>
      (PRIORIDADE_SLA_INT[(a.status_sla_inteligente ?? 'sem_prazo') as SlaInteligenteStatus] ?? 5) -
      (PRIORIDADE_SLA_INT[(b.status_sla_inteligente ?? 'sem_prazo') as SlaInteligenteStatus] ?? 5) ||
      (b.tempo_em_estado_atual_min ?? 0) - (a.tempo_em_estado_atual_min ?? 0),
    )
    .slice(0, 5);

  // Gargalo por fase — ordenado por maior volume
  const FASES_ORDEM: FaseSla[] = ['triagem', 'inspecao', 'confirmacao', 'tratamento'];
  const gargaloPorFase = FASES_ORDEM
    .map((fase) => ({
      fase,
      label: LABEL_FASE_SLA[fase],
      count: slaInteligenteList.filter((f) => f.fase_sla === fase).length,
    }))
    .filter((g) => g.count > 0)
    .sort((a, b) => b.count - a.count);

  // Alertas urgentes
  const alertas = [
    kpis && kpis.slas_vencendo_2h > 0
      ? { msg: `${kpis.slas_vencendo_2h} SLA${kpis.slas_vencendo_2h > 1 ? 's' : ''} vencem em menos de 2 horas`, icon: Clock, color: 'text-red-600 bg-red-50 border-red-200' }
      : null,
    kpis && kpis.denuncias_ultimas_24h > 3
      ? { msg: `${kpis.denuncias_ultimas_24h} denúncias de cidadãos nas últimas 24h`, icon: MessageSquare, color: 'text-orange-700 bg-orange-50 border-orange-200' }
      : null,
    kpis && kpis.casos_hoje > 0
      ? { msg: `${kpis.casos_hoje} caso${kpis.casos_hoje > 1 ? 's' : ''} notificado${kpis.casos_hoje > 1 ? 's' : ''} hoje`, icon: Stethoscope, color: 'text-amber-700 bg-amber-50 border-amber-200' }
      : null,
    casosCruzados > 0
      ? { msg: `${casosCruzados} cruzamento${casosCruzados > 1 ? 's' : ''} caso↔foco hoje — focos priorizados automaticamente`, icon: GitMerge, color: 'text-red-700 bg-red-50 border-red-200' }
      : null,
  ].filter(Boolean);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Central Operacional</h1>
            <p className="text-sm text-muted-foreground">
              {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Atualizado {formatDistanceToNow(lastRefresh, { locale: ptBR, addSuffix: true })}
          </span>
          <Button variant="outline" size="sm" onClick={handleRefresh} className="h-8 gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={handleGerarPdf}
            disabled={pdfLoading || kpisLoading}
          >
            <FileText className="h-3.5 w-3.5" />
            {pdfLoading ? 'Gerando...' : 'Relatório PDF'}
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => navigate('/gestor/triagem')}
          >
            <MapPin className="h-3.5 w-3.5" />
            Planejar hoje
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Alertas urgentes */}
      {alertas.length > 0 && (
        <div className="space-y-2">
          {alertas.map((a, i) => a && (
            <div key={i} className={cn('flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm font-medium', a.color)}>
              <a.icon className="h-4 w-4 shrink-0" />
              {a.msg}
            </div>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          title="Focos pendentes"
          value={kpis?.focos_pendentes}
          subtitle={`${kpis?.focos_em_atendimento ?? 0} em atendimento`}
          icon={AlertTriangle}
          color="text-orange-500"
          loading={kpisLoading}
          onClick={() => navigate('/gestor/focos?status=pendente')}
        />
        {/* G1: SLA split — vencidos vs vencendo */}
        <Card
          className={cn(
            'border-border/60 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all',
            (kpis?.slas_vencidos ?? 0) > 0 && 'border-red-300 bg-red-50/50 dark:bg-red-950/20',
          )}
          onClick={() => navigate('/admin/sla')}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">SLA</p>
              <Clock className="h-4 w-4 shrink-0 text-destructive" />
            </div>
            {kpisLoading ? (
              <Skeleton className="h-8 w-24 mt-2" />
            ) : (
              <div className="mt-2 flex items-end gap-3">
                <div>
                  <span className={cn('text-3xl font-bold tabular-nums', (kpis?.slas_vencidos ?? 0) > 0 ? 'text-red-600' : 'text-foreground')}>
                    {kpis?.slas_vencidos ?? 0}
                  </span>
                  <p className="text-[10px] text-muted-foreground leading-tight">vencidos</p>
                </div>
                {(kpis?.slas_vencendo_2h ?? 0) > 0 && (
                  <>
                    <span className="text-muted-foreground/30 text-lg pb-3">|</span>
                    <div>
                      <span className="text-2xl font-bold tabular-nums text-amber-500">
                        {kpis!.slas_vencendo_2h}
                      </span>
                      <p className="text-[10px] text-muted-foreground leading-tight">vencem em 2h</p>
                    </div>
                  </>
                )}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground/60 mt-2 flex items-center gap-0.5">
              Ver detalhes <ArrowRight className="w-3 h-3" />
            </p>
          </CardContent>
        </Card>
        <KpiCard
          title="Imóveis críticos"
          value={kpis?.imoveis_criticos}
          subtitle={`${kpis?.imoveis_muito_alto ?? 0} muito alto`}
          icon={MapPin}
          color="text-red-600"
          loading={kpisLoading}
          urgent
          onClick={() => navigate('/gestor/mapa?classificacao=critico')}
        />
        <KpiCard
          title="Agentes hoje"
          value={kpis?.agentes_ativos_hoje}
          subtitle={`${kpis?.vistorias_hoje ?? 0} vistorias realizadas`}
          icon={Users}
          color="text-primary"
          loading={kpisLoading}
        />
      </div>

      {/* M-04: Empty state quando não há atividade registrada hoje */}
      {!kpisLoading && kpis && kpis.focos_pendentes === 0 && kpis.slas_vencidos === 0 && kpis.imoveis_criticos === 0 && kpis.agentes_ativos_hoje === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800/40 px-4 py-3 text-sm text-blue-700 dark:text-blue-400">
          <Info className="w-4 h-4 shrink-0" />
          Nenhuma atividade registrada hoje ainda. Conforme os agentes iniciarem vistorias, os dados aparecerão aqui.
        </div>
      )}

      {/* Cruzamentos caso↔foco hoje */}
      {casosCruzados > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800/40 px-4 py-3">
          <GitMerge className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">
              <span className="text-base font-bold">{casosCruzados}</span>{' '}
              cruzamento{casosCruzados > 1 ? 's' : ''} caso↔foco hoje
            </p>
            <p className="text-xs text-red-700/70 dark:text-red-400/70">
              Casos notificados próximos a focos ativos — prioridade elevada automaticamente
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-red-700 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30 shrink-0"
            onClick={() => navigate('/admin/casos')}
          >
            Ver casos <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top imóveis críticos */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Imóveis prioritários
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => navigate('/gestor/mapa?classificacao=critico,muito_alto')}
              >
                Ver todos <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {imoveisLoading ? (
              <div className="space-y-2 px-4 pb-4">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
              </div>
            ) : imoveisParaHoje.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground text-center py-6">
                Nenhum imóvel em nível crítico ou alto no momento.
              </p>
            ) : (
              <div className="divide-y divide-border/50">
                {imoveisParaHoje.slice(0, 8).map((im) => (
                  <div
                    key={im.imovel_id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => navigate(`/gestor/mapa?imovel=${im.imovel_id}`)}
                  >
                    <ScoreBadge score={im.score} classificacao={im.classificacao} size="sm" showScore />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {[im.logradouro, im.numero].filter(Boolean).join(', ') || 'Endereço não informado'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[im.bairro, im.quarteirao && `Q. ${im.quarteirao}`].filter(Boolean).join(' · ')}
                        {im.focos_ativos_count > 0 && ` · ${im.focos_ativos_count} foco${im.focos_ativos_count > 1 ? 's' : ''}`}
                      </p>
                    </div>
                    {im.sla_mais_urgente && (
                      <Badge variant="outline" className="text-[10px] text-red-600 border-red-300 bg-red-50 shrink-0">
                        SLA {formatDistanceToNow(new Date(im.sla_mais_urgente), { locale: ptBR, addSuffix: true })}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Score do município */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Score territorial
                {kpis?.score_medio_municipio != null && (
                  <Badge variant="outline" className="text-xs ml-1">
                    Média: {kpis.score_medio_municipio.toFixed(1)}
                  </Badge>
                )}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => navigate('/admin/score-config')}
              >
                Configurar <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scoreDistribuicao} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(value) => [value, 'Imóveis']}
                    labelFormatter={(l) => `Classe: ${l}`}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {SCORE_CLASSES.map((sc) => (
                      <Cell key={sc.key} fill={sc.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 grid grid-cols-5 gap-1">
              {SCORE_CLASSES.map((sc) => (
                <div key={sc.key} className="text-center">
                  <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: sc.color }} />
                  <p className="mt-1 text-[9px] text-muted-foreground">{sc.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* G4: Regiões sem cobertura hoje */}
      {regioesSemCobertura.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800/40 px-4 py-3">
          <MapPinOff className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {regioesSemCobertura.length} região{regioesSemCobertura.length > 1 ? 'ões' : ''} sem vistoria hoje
            </p>
            <p className="text-xs text-amber-700/70 dark:text-amber-400/70 mt-0.5 line-clamp-1">
              {regioesSemCobertura.map((r) => r.regiao).join(' · ')}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-amber-700 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/30 shrink-0"
            onClick={() => navigate('/admin/distribuicao-quarteirao')}
          >
            Distribuição <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
          </Button>
        </div>
      )}

      <Separator className="bg-border/60" />

      {/* Funil operacional do piloto */}
      <PainelPilotoFunilCard />

      <Separator className="bg-border/60" />

      {/* SLA Inteligente */}
      {(slaIntVencidos > 0 || slaIntCriticos > 0 || slaIntAtencao > 0) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">SLA Inteligente por fase</h2>
          </div>

          {/* Contadores clicáveis */}
          <div className="grid grid-cols-3 gap-2">
            {slaIntVencidos > 0 && (
              <div
                className="rounded-lg border border-red-200 bg-red-50/60 dark:bg-red-950/20 dark:border-red-800/40 px-3 py-2 text-center cursor-pointer hover:bg-red-100/70 dark:hover:bg-red-950/30 transition-colors"
                onClick={() => navigate('/gestor/focos?sla_int=vencido')}
                title="Ver focos com SLA vencido"
              >
                <p className="text-2xl font-bold tabular-nums text-red-600">{slaIntVencidos}</p>
                <p className="text-[10px] text-red-700/70 dark:text-red-400/70 uppercase tracking-wide mt-0.5">Vencido</p>
              </div>
            )}
            {slaIntCriticos > 0 && (
              <div
                className="rounded-lg border border-orange-200 bg-orange-50/60 dark:bg-orange-950/20 dark:border-orange-800/40 px-3 py-2 text-center cursor-pointer hover:bg-orange-100/70 dark:hover:bg-orange-950/30 transition-colors"
                onClick={() => navigate('/gestor/focos?sla_int=critico')}
                title="Ver focos com SLA crítico"
              >
                <p className="text-2xl font-bold tabular-nums text-orange-600">{slaIntCriticos}</p>
                <p className="text-[10px] text-orange-700/70 dark:text-orange-400/70 uppercase tracking-wide mt-0.5">Crítico</p>
              </div>
            )}
            {slaIntAtencao > 0 && (
              <div
                className="rounded-lg border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 dark:border-amber-800/40 px-3 py-2 text-center cursor-pointer hover:bg-amber-100/70 dark:hover:bg-amber-950/30 transition-colors"
                onClick={() => navigate('/gestor/focos?sla_int=atencao')}
                title="Ver focos com SLA em atenção"
              >
                <p className="text-2xl font-bold tabular-nums text-amber-600">{slaIntAtencao}</p>
                <p className="text-[10px] text-amber-700/70 dark:text-amber-400/70 uppercase tracking-wide mt-0.5">Atenção</p>
              </div>
            )}
          </div>

          {/* Gargalo por fase */}
          {gargaloPorFase.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Distribuição por fase</p>
              <div className="flex flex-wrap gap-1.5">
                {gargaloPorFase.map(({ fase, label, count }) => {
                  const max = gargaloPorFase[0].count;
                  const isGargalo = count === max && max > 0;
                  return (
                    <div
                      key={fase}
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs',
                        isGargalo
                          ? 'border-orange-200 bg-orange-50/60 dark:bg-orange-950/20 dark:border-orange-800/40'
                          : 'border-border/60 bg-muted/30',
                      )}
                    >
                      <span className="font-semibold tabular-nums text-sm">{count}</span>
                      <span className="text-muted-foreground">{label}</span>
                      {isGargalo && gargaloPorFase.length > 1 && (
                        <span className="text-[9px] font-bold text-orange-600 dark:text-orange-400 uppercase">gargalo</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top 5 mais urgentes */}
          {slaIntTop5.length > 0 && (
            <div className="rounded-xl border border-border/60 divide-y divide-border/50 overflow-hidden">
              {slaIntTop5.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 cursor-pointer transition-colors text-sm"
                  onClick={() => navigate(`/gestor/focos/${f.id}`)}
                >
                  <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${COR_STATUS_SLA_INT[(f.status_sla_inteligente ?? 'sem_prazo') as SlaInteligenteStatus]}`}>
                    {LABEL_STATUS_SLA_INT[(f.status_sla_inteligente ?? 'sem_prazo') as SlaInteligenteStatus]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-xs text-foreground">
                      {f.logradouro || f.bairro || 'Endereço não informado'}
                    </p>
                    {f.fase_sla && (
                      <p className="text-[10px] text-muted-foreground">
                        {LABEL_FASE_SLA[f.fase_sla as FaseSla]} · {formatarTempoMin(f.tempo_em_estado_atual_min)}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Separator className="bg-border/60" />

      {/* ── Vistorias por prioridade (Fase 4.3/4.4) ──────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Vistorias por prioridade</h2>
          {!vstLoading && vistoriasConsolidadas.length > 0 && (
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {vistoriasConsolidadas.length > 20
                ? `mostrando 20 de ${vistoriasConsolidadas.length}`
                : vistoriasConsolidadas.length}
            </span>
          )}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2">
          {([
            { key: '' as const,    label: 'Todas' },
            { key: 'P1' as const,  label: 'P1' },
            { key: 'P2' as const,  label: 'P2' },
            { key: 'P3+' as const, label: 'P3–P5' },
          ]).map(({ key, label }) => (
            <button
              key={key || 'todas'}
              onClick={() => setFiltroVstPrioridade(key)}
              className={cn(
                'px-2.5 py-1 text-xs rounded-full border transition-colors',
                filtroVstPrioridade === key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
          <button
            onClick={() => setFiltroVstIncompleto((v) => !v)}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border transition-colors',
              filtroVstIncompleto
                ? 'bg-amber-100 text-amber-800 border-amber-400 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700'
                : 'border-border/60 text-muted-foreground hover:border-amber-400/60',
            )}
          >
            <AlertTriangle className="w-3 h-3" />
            Incompletas
          </button>
        </div>

        {/* Lista */}
        {vstLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
        ) : vistoriasConsolidadas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma vistoria encontrada{filtroVstPrioridade || filtroVstIncompleto ? ' para os filtros aplicados' : ''}.
          </p>
        ) : (
          <div className="rounded-xl border border-border/60 divide-y divide-border/50 overflow-hidden">
            {vistoriasConsolidadas.slice(0, 20).map((v) => {
              const imovel = v.imovel as { id?: string; logradouro?: string; numero?: string; bairro?: string } | null;
              const agente = v.agente as { nome?: string } | null;
              return (
                <div
                  key={v.id}
                  onClick={() => imovel?.id && navigate(`/gestor/mapa?imovel=${imovel.id}`)}
                  className={cn(
                    'flex items-start gap-3 px-4 py-3 transition-colors',
                    imovel?.id && 'cursor-pointer hover:bg-muted/30',
                    v.prioridade_final === 'P1' && 'bg-red-50/50 dark:bg-red-950/20',
                    v.prioridade_final === 'P2' && 'bg-orange-50/40 dark:bg-orange-950/10',
                  )}
                >
                  <PrioridadeConsolidacaoBadge prioridade={v.prioridade_final} size="sm" />
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-xs font-medium text-foreground truncate">
                      {[imovel?.logradouro, imovel?.numero].filter(Boolean).join(', ') || 'Endereço não informado'}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {[
                        imovel?.bairro,
                        agente?.nome,
                        v.data_visita && new Date(v.data_visita).toLocaleDateString('pt-BR'),
                      ].filter(Boolean).join(' · ')}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <DimensoesBadges
                        vulnerabilidade_domiciliar={v.vulnerabilidade_domiciliar ?? undefined}
                        alerta_saude={v.alerta_saude ?? undefined}
                        risco_socioambiental={v.risco_socioambiental ?? undefined}
                        risco_vetorial={v.risco_vetorial ?? undefined}
                      />
                      {v.consolidacao_incompleta && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="w-3 h-3" /> Incompleto
                        </span>
                      )}
                    </div>
                  </div>
                  {imovel?.id && (
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 mt-1" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Separator className="bg-border/60" />

      {/* Agentes em campo */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Agentes em campo hoje</h2>
          <Badge variant="outline" className="text-xs gap-1.5 ml-auto">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
            Ao vivo
          </Badge>
        </div>
        <AgentesHojeWidget />
        <ResumoIAWidget />
      </div>
    </div>
  );
}
