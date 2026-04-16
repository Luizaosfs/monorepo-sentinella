import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  ClipboardList,
  AlertTriangle,
  MapPin,
  WifiOff,
  LayoutDashboard,
  Shield,
  FileText,
  Timer,
  Circle,
  CloudRain,
  ChevronRight,
  UserX,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { useAuth } from '@/hooks/useAuth';
import { Logo } from '@/components/Logo';
import PullToRefresh from '@/components/PullToRefresh';
import { useLevantamentos } from '@/hooks/queries/useLevantamentos';
import {
  useItensPorCliente,
  useAtendimentoCountsPorCliente,
  useResolvidosRecentesPorCliente,
} from '@/hooks/queries/useLevantamentoItens';
import { useSlaPendingCount } from '@/hooks/queries/useSla';
import { StatCard } from '@/components/dashboard/StatsGrid';
import { RiskDistributionChart } from '@/components/dashboard/RiskDistributionChart';
import { PriorityChart } from '@/components/dashboard/PriorityChart';
import { PluvioRiskWidget } from '@/components/dashboard/PluvioRiskWidget';
import { OperacionalWidget } from '@/components/dashboard/OperacionalWidget';
import { SlaWidget } from '@/components/dashboard/SlaWidget';
import { OperacoesWidget } from '@/components/dashboard/OperacoesWidget';
import { StormAlertWidget } from '@/components/dashboard/StormAlertWidget';
import { SlaEvolutionChart } from '@/components/dashboard/SlaEvolutionChart';
import { AtendimentoStatusWidget } from '@/components/dashboard/AtendimentoStatusWidget';
import { ScoreSurtoWidget } from '@/components/dashboard/ScoreSurtoWidget';
import { PainelSLAWidget } from '@/components/PainelSLAWidget';
import { ResumoDiarioWidget } from '@/components/dashboard/ResumoDiarioWidget';
import { DashboardSkeleton } from '@/components/ui/Skeletons';
import { PainelSLAResumo } from '@/components/dashboard/PainelSLAResumo';
import { FocoRiscoCard } from '@/components/foco/FocoRiscoCard';
import { useFocosRisco } from '@/hooks/queries/useFocosRisco';
import { Target } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import { useCentralKpis } from '@/hooks/queries/useCentralOperacional';

function AtencaoImediata({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  const { data: kpis, isLoading } = useCentralKpis();

  const slaVencidos        = kpis?.slas_vencidos ?? 0;
  const denunciasPendentes = kpis?.denuncias_ultimas_24h ?? 0;
  const p1SemAgente        = kpis?.focos_p1_sem_agente ?? 0;

  if (isLoading) return null;
  if (slaVencidos === 0 && denunciasPendentes === 0 && p1SemAgente === 0) return null;

  return (
    <section aria-label="Atenção imediata" className="space-y-2">
      <h2 className="text-xs font-bold text-destructive uppercase tracking-wider flex items-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5" />
        Atenção imediata
      </h2>
      <div className="grid gap-2 sm:grid-cols-3">
        {slaVencidos > 0 && (
          <button
            type="button"
            onClick={() => navigate('/admin/sla')}
            className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-200 hover:bg-red-100 transition-colors text-left dark:bg-red-950/30 dark:border-red-800/40"
          >
            <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
              <Timer className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-red-700 dark:text-red-400">
                {slaVencidos} SLA{slaVencidos !== 1 ? 's' : ''} vencido{slaVencidos !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-red-600/80 dark:text-red-500 truncate">
                Itens fora do prazo — ver painel SLA
              </p>
            </div>
          </button>
        )}
        {denunciasPendentes > 0 && (
          <button
            type="button"
            onClick={() => navigate('/gestor/focos?origem=cidadao')}
            className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors text-left dark:bg-amber-950/30 dark:border-amber-800/40"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
                {denunciasPendentes} denúncia{denunciasPendentes !== 1 ? 's' : ''} cidadão
              </p>
              <p className="text-xs text-amber-600/80 dark:text-amber-500 truncate">
                Nas últimas 24h — ver focos
              </p>
            </div>
          </button>
        )}
        {p1SemAgente > 0 && (
          <button
            type="button"
            onClick={() => navigate('/gestor/focos?prioridade=P1&sem_responsavel=true')}
            className="flex items-center gap-3 p-3 rounded-xl bg-purple-50 border border-purple-200 hover:bg-purple-100 transition-colors text-left dark:bg-purple-950/30 dark:border-purple-800/40"
          >
            <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center shrink-0">
              <UserX className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-purple-700 dark:text-purple-400">
                {p1SemAgente} foco{p1SemAgente !== 1 ? 's' : ''} P1 sem agente
              </p>
              <p className="text-xs text-purple-600/80 dark:text-purple-500 truncate">
                Críticos sem responsável — atribuir agora
              </p>
            </div>
          </button>
        )}
      </div>
    </section>
  );
}

function RiscoClimaticoPrevisto({ clienteId, navigate }: { clienteId: string; navigate: ReturnType<typeof useNavigate> }) {
  const { data: regioes = [] } = useQuery({
    queryKey: ['risco-pluvio-dashboard', clienteId],
    queryFn: () => api.pluvio.riscoByCliente(clienteId),
    enabled: !!clienteId,
    staleTime: STALE.SHORT,
  });

  // Use the highest risk region
  const piorRegiao = regioes
    .filter((r) => r.risco)
    .sort((a, b) => {
      const ordem: Record<string, number> = { 'Muito Alto': 5, Alto: 4, Moderado: 3, Baixo: 2, 'Muito Baixo': 1 };
      return (ordem[b.risco?.classificacao_final ?? ''] ?? 0) - (ordem[a.risco?.classificacao_final ?? ''] ?? 0);
    })[0];

  if (!piorRegiao?.risco) return null;

  const risco = piorRegiao.risco;
  const diasPosChuva = risco.dias_pos_chuva ?? 0;
  const chuva24h = risco.chuva_24h ?? 0;
  const janelaAtiva = diasPosChuva >= 3 && diasPosChuva <= 6 && (chuva24h > 20 || (risco.chuva_72h ?? 0) > 20);

  const COR_CLASSIFICACAO: Record<string, string> = {
    'Muito Alto': 'text-red-600',
    Alto: 'text-orange-500',
    Moderado: 'text-amber-500',
    Baixo: 'text-green-600',
    'Muito Baixo': 'text-green-500',
  };

  const BG_CLASSIFICACAO: Record<string, string> = {
    'Muito Alto': 'bg-red-50 border-red-200',
    Alto: 'bg-orange-50 border-orange-200',
    Moderado: 'bg-amber-50 border-amber-200',
    Baixo: 'bg-green-50 border-green-200',
    'Muito Baixo': 'bg-green-50 border-green-100',
  };

  const classificacao = risco.classificacao_final ?? 'Indefinido';
  const corTexto = COR_CLASSIFICACAO[classificacao] ?? 'text-gray-600';
  const bgCard = BG_CLASSIFICACAO[classificacao] ?? 'bg-gray-50 border-gray-200';

  return (
    <section aria-label="Risco Climático Previsto">
      <button
        type="button"
        onClick={() => navigate('/admin/risco-pluvial')}
        className={`w-full flex items-start gap-3 p-3 rounded-xl border ${janelaAtiva ? 'bg-amber-50 border-amber-200' : bgCard} hover:brightness-95 transition-all text-left`}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${janelaAtiva ? 'bg-amber-100' : 'bg-white/60'}`}>
          <CloudRain className={`w-4 h-4 ${janelaAtiva ? 'text-amber-600' : corTexto}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Risco Climático Previsto</p>
            <span className={`text-xs font-bold ${janelaAtiva ? 'text-amber-700' : corTexto}`}>
              {janelaAtiva ? 'Janela crítica ativa' : classificacao}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 truncate">
            {janelaAtiva
              ? 'Janela crítica ativa — priorize vistorias hoje'
              : '3–6 dias após chuva intensa = janela crítica para larvas'}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-400 shrink-0 mt-1" />
      </button>
    </section>
  );
}

const DASH_TABS = ['geral', 'sla', 'focos', 'levantamentos'] as const;

const Dashboard = () => {
  const { clienteId, loading: clienteLoading } = useClienteAtivo();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAdminOrSupervisor } = useAuth();
  const [activeTab, setActiveTab] = useState(() => {
    const t = searchParams.get('tab');
    if (t && (DASH_TABS as readonly string[]).includes(t)) return t;
    return 'levantamentos';
  });

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && (DASH_TABS as readonly string[]).includes(t)) setActiveTab(t);
  }, [searchParams]);

  const { data: levantamentos = [], isLoading: levLoading, isError: levError, refetch: refetchLev } = useLevantamentos(clienteId);
  const { data: itens = [], isLoading: itemsLoading, isError: itemsError, refetch: refetchItens } = useItensPorCliente(clienteId);
  const {
    data: atendimentoCounts,
    isLoading: atendimentoCountsLoading,
    refetch: refetchAtendimentoCounts,
  } = useAtendimentoCountsPorCliente(clienteId);
  const { data: resolvidosRecentes = [], refetch: refetchResolvidosRecentes } = useResolvidosRecentesPorCliente(clienteId);

  const loading = levLoading || itemsLoading;
  const offline = levError || itemsError;
  const { data: slaPendingCount = 0 } = useSlaPendingCount(clienteId);

  const fetchData = async () => {
    await Promise.all([
      refetchLev(),
      refetchItens(),
      refetchAtendimentoCounts(),
      refetchResolvidosRecentes(),
    ]);
  };

  const { riskData, priorityData, stats, highRiskCount, pendentesCount } = useMemo(() => {
    const riskCounts: Record<string, number> = {};
    const priorityCounts: Record<string, number> = {
      'P1': 0,
      'P2': 0,
      'P3': 0,
      'P4': 0,
    };
    let highRisk = 0;
    let pendentesSlice = 0;

    itens.forEach(item => {
      const risk = item.risco || 'indefinido';
      let priority = item.prioridade;
      if (typeof priority === 'string') {
        priority = priority.toUpperCase();
      } else {
        priority = 'Indefinida';
      }

      riskCounts[risk] = (riskCounts[risk] || 0) + 1;
      priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;

      if (['alto', 'critico'].includes(risk.toLowerCase())) highRisk++;
      if ((item.status_atendimento ?? 'pendente') === 'pendente') pendentesSlice++;
    });

    const totalItens = atendimentoCounts?.total ?? itens.length;
    const pendentes = atendimentoCounts?.pendente ?? pendentesSlice;

    return {
      riskData: Object.entries(riskCounts).map(([name, value]) => ({ name, value })),
      priorityData: Object.entries(priorityCounts).map(([name, value]) => ({ name, value })),
      highRiskCount: highRisk,
      pendentesCount: pendentes,
      stats: [
        { title: 'Levantamentos', value: levantamentos.length, icon: ClipboardList, color: 'text-primary', tooltip: 'Total de levantamentos cadastrados para este cliente (drone + manual). Inclui todos os status.' },
        {
          title: 'Itens Identificados',
          value: totalItens,
          icon: MapPin,
          color: 'text-primary',
          tooltip:
            'Total de pontos/focos em todos os levantamentos (contagem no banco). Gráficos de risco/prioridade usam uma amostra da lista carregada.',
        },
        { title: 'Alto Risco', value: highRisk, icon: AlertTriangle, color: 'text-destructive', tooltip: 'Itens classificados como risco Alto ou Crítico. Devem ser priorizados na operação de campo e no plano de ação.' },
        { title: 'Pendentes', value: pendentes, icon: Circle, color: pendentes > 0 ? 'text-amber-500' : 'text-primary', tooltip: 'Itens ainda não atendidos (sem agente de campo ou ação registrada). Acompanhe pelo painel de SLA.' },
      ]
    };
  }, [itens, levantamentos.length, atendimentoCounts]);

  if (loading || clienteLoading) {
    return (
      <div className="p-4 lg:p-6">
        <DashboardSkeleton />
      </div>
    );
  }

  if (!clienteId) {
    return (
      <Card className="card-premium border-2">
        <CardContent className="py-12 flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center border border-border">
            <WifiOff className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <h3 className="text-lg font-bold">Cliente não vinculado</h3>
          <p className="text-muted-foreground text-sm max-w-[300px]">
            Seu usuário não está vinculado a um cliente ativo. Entre em contato com o suporte.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <PullToRefresh onRefresh={fetchData}>
      <div className="space-y-6 lg:space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border/60">
          <div>
            <h1 className="text-2xl flex items-center gap-1.5 mb-1">
              <Logo className="text-2xl text-primary" />
              <span className="text-2xl font-black tracking-tight text-foreground">MAP</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitoramento estratégico de pontos estruturais e focos urbanos.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <span className="text-[11px] font-medium text-muted-foreground mr-2 hidden sm:block">Atualizado há 2 minutos</span>
            <div className="flex gap-2 w-full sm:w-auto">
              <button className="flex-1 sm:flex-none px-4 py-2 bg-card border border-border/60 text-foreground text-xs font-bold rounded-xl shadow-sm hover:bg-muted/40 transition-colors">
                Exportar
              </button>
              <button
                onClick={() => navigate('/mapa')}
                className="flex-1 sm:flex-none px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-md hover:bg-primary/90 transition-colors"
              >
                Acessar Mapa
              </button>
            </div>
          </div>
        </div>

        {offline && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-orange-500/10 border border-orange-500/30 animate-fade-in">
            <WifiOff className="w-5 h-5 text-orange-500 shrink-0" />
            <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">Você está offline ou ocorreu um erro de conexão. Exibindo dados em cache.</p>
          </div>
        )}

        {/* Atenção imediata — SLA vencidos + denúncias cidadão */}
        <AtencaoImediata navigate={navigate} />

        {/* Risco Climático Previsto */}
        <RiscoClimaticoPrevisto clienteId={clienteId} navigate={navigate} />

        {/* Resumo executivo único (5 KPIs) — sem repetir nas abas */}
        <section aria-label="Resumo executivo">
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {[
              ...stats,
              {
                title: 'SLA pendente',
                value: slaPendingCount,
                icon: Timer,
                color: slaPendingCount > 0 ? 'text-amber-500' : 'text-primary',
              },
            ].map((card, index) => {
              const onClickMap: Record<string, () => void> = {
                'Levantamentos':       () => navigate('/levantamentos'),
                'Itens Identificados': () => navigate('/mapa'),
                'Alto Risco':          () => navigate('/mapa?risco=alto,critico'),
                'Pendentes':           () => navigate('/mapa?atendimento=pendente'),
                'SLA pendente':        () =>
                  navigate(isAdminOrSupervisor ? '/admin/sla' : '/dashboard?tab=sla'),
              };
              return (
                <StatCard key={card.title} {...card} index={index} onClick={onClickMap[card.title]} />
              );
            })}
          </div>
        </section>

        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            setActiveTab(v);
          }}
          className="w-full"
        >
          <TabsList className="w-full grid grid-cols-4 h-auto p-1 bg-muted/40 border border-border/40 rounded-xl">
            <TabsTrigger
              value="levantamentos"
              className="relative flex items-center gap-1.5 text-xs font-bold py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Levantamentos</span>
              {highRiskCount > 0 ? (
                <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-destructive text-destructive-foreground">
                  {highRiskCount}
                </span>
              ) : levantamentos.length > 0 ? (
                <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-primary/10 text-primary">
                  {levantamentos.length}
                </span>
              ) : null}
            </TabsTrigger>

            <TabsTrigger
              value="geral"
              className="relative flex items-center gap-1.5 text-xs font-bold py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Painel Operacional</span>
            </TabsTrigger>

            <TabsTrigger
              value="sla"
              className="relative flex items-center gap-1.5 text-xs font-bold py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Shield className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">SLA</span>
              {slaPendingCount > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  {slaPendingCount}
                </span>
              )}
            </TabsTrigger>

            <TabsTrigger
              value="focos"
              className="relative flex items-center gap-1.5 text-xs font-bold py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Target className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Focos</span>
            </TabsTrigger>
          </TabsList>

          {/* Aba Geral (Painel Operacional) */}
          <TabsContent value="geral" className="mt-6 space-y-6">
            <ResumoDiarioWidget />
            <StormAlertWidget clienteId={clienteId} />
            <PluvioRiskWidget clienteId={clienteId} />
            <OperacionalWidget clienteId={clienteId} />
          </TabsContent>

          {/* Aba Levantamentos: alertas + gráficos + histórico */}
          <TabsContent value="levantamentos" className="mt-6 space-y-6">
            {(highRiskCount > 0 || slaPendingCount > 0) && (
              <div className="space-y-2" role="region" aria-label="Alertas">
                {highRiskCount > 0 && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                    <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                    <span className="text-sm font-medium text-foreground">
                      {highRiskCount} {highRiskCount === 1 ? 'ponto' : 'pontos'} de alto risco —{' '}
                      <button
                        type="button"
                        onClick={() => navigate('/mapa?risco=alto,critico')}
                        className="text-primary font-semibold hover:underline"
                      >
                        ver no mapa
                      </button>
                    </span>
                  </div>
                )}
                {slaPendingCount > 0 && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <Timer className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="text-sm font-medium text-foreground">
                      {slaPendingCount} {slaPendingCount === 1 ? 'item' : 'itens'} em SLA pendente —{' '}
                      <button type="button" onClick={() => setActiveTab('sla')} className="text-primary font-semibold hover:underline">
                        abrir aba SLA
                      </button>
                    </span>
                  </div>
                )}
                {pendentesCount > 0 && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/60 border border-border/60">
                    <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium text-foreground">
                      {pendentesCount} {pendentesCount === 1 ? 'item pendente' : 'itens pendentes'} aguardando atendimento —{' '}
                      <button
                        type="button"
                        onClick={() => navigate('/mapa?atendimento=pendente')}
                        className="text-primary font-semibold hover:underline"
                      >
                        ver no mapa
                      </button>
                    </span>
                  </div>
                )}
              </div>
            )}

            <AtendimentoStatusWidget
              counts={atendimentoCounts}
              recentes={resolvidosRecentes}
              isLoading={atendimentoCountsLoading}
            />

            <div className="grid gap-4 lg:gap-6 lg:grid-cols-2">
              <PriorityChart data={priorityData} />
              <RiskDistributionChart data={riskData} />
            </div>
            <Card className="rounded-2xl shadow-sm border-border/60 bg-card overflow-hidden flex flex-col animate-fade-in">
              <CardHeader className="flex flex-row items-center justify-between p-5 border-b border-border/60">
                <div>
                  <CardTitle className="text-base font-bold text-foreground">Levantamentos Recentes</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Histórico de inspeções e envios</p>
                </div>
                <button
                  onClick={() => navigate('/levantamentos')}
                  className="h-8 px-3 rounded-lg border border-border/60 text-[11px] font-bold text-foreground hover:bg-muted/40 transition-colors shadow-sm"
                >
                  Ver todos
                </button>
              </CardHeader>
              <CardContent className="p-0">
                {levantamentos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mb-3 border border-border">
                      <ClipboardList className="w-6 h-6 opacity-40" />
                    </div>
                    <p className="text-sm font-semibold">Nenhum levantamento</p>
                    <p className="text-xs mt-1 opacity-70">Os novos relatórios aparecerão aqui.</p>
                  </div>
                ) : (
                  <div className="p-4 lg:p-6 pb-2">
                    <div className="relative border-l-2 border-border/50 ml-6 space-y-8">
                      {levantamentos.slice(0, 5).map((lev) => (
                        <div
                          key={lev.id}
                          className="relative pl-6 cursor-pointer group"
                          onClick={() => navigate(`/levantamentos?lev=${lev.id}`)}
                        >
                          <span className="absolute -left-[17px] top-1 flex h-8 w-8 items-center justify-center rounded-full bg-card border-2 border-primary group-hover:bg-primary transition-colors">
                            <ClipboardList className="h-3.5 w-3.5 text-primary group-hover:text-white transition-colors" />
                          </span>

                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-4 rounded-xl border border-border/40 bg-muted/10 group-hover:bg-muted/40 transition-colors shadow-sm">
                            <div className="flex flex-col gap-1.5">
                              <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                                {lev.titulo}
                              </h4>
                              <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-muted-foreground">
                                <span>
                                  {new Date(lev.data_voo).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </span>
                                <span className="w-1 h-1 rounded-full bg-border/80" />
                                <span>
                                  Enviado há {Math.floor((new Date().getTime() - new Date(lev.created_at).getTime()) / (1000 * 3600 * 24))} dias
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant="outline" className="font-bold text-[10px] tracking-wider uppercase px-2 py-0.5 bg-background shadow-none border-border">
                                {lev.total_itens} Apontamentos
                              </Badge>
                              <Badge className="font-bold text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-transparent shadow-none px-2 py-0.5 uppercase tracking-wider">
                                Processado
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {levantamentos.length > 5 && (
                  <div className="p-4 border-t border-border/40 bg-muted/10 text-center">
                    <button
                      onClick={() => navigate('/levantamentos')}
                      className="text-xs font-bold text-primary hover:underline transition-all"
                    >
                      Ver histórico completo
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba SLA */}
          <TabsContent value="sla" className="mt-6 space-y-6">
            <PainelSLAWidget />
            <ScoreSurtoWidget />
            <SlaWidget clienteId={clienteId} />
            <OperacoesWidget clienteId={clienteId} />
            <SlaEvolutionChart clienteId={clienteId} />
          </TabsContent>

          {/* Aba Focos de Risco */}
          <TabsContent value="focos" className="mt-6 space-y-6">
            <FocosRiscoSection clienteId={clienteId} navigate={navigate} />
          </TabsContent>
        </Tabs>
      </div>
    </PullToRefresh>
  );
};

function FocosRiscoSection({ clienteId, navigate }: { clienteId: string; navigate: ReturnType<typeof useNavigate> }) {
  const { data } = useFocosRisco(clienteId, {
    status: ['suspeita', 'em_triagem', 'aguarda_inspecao', 'em_inspecao', 'confirmado', 'em_tratamento'],
    pageSize: 5,
  });
  const focos = data?.data ?? [];

  return (
    <div className="space-y-4">
      <PainelSLAResumo />
      <Card className="rounded-2xl shadow-sm border-border/60 bg-card overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between p-5 border-b border-border/60">
          <div>
            <CardTitle className="text-base font-bold text-foreground">Focos mais críticos</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Ordenados por SLA e prioridade</p>
          </div>
          <button
            onClick={() => navigate('/gestor/focos')}
            className="h-8 px-3 rounded-lg border border-border/60 text-[11px] font-bold text-foreground hover:bg-muted/40 transition-colors shadow-sm"
          >
            Ver todos
          </button>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {focos.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-6">Nenhum foco ativo no momento.</p>
          ) : (
            focos.map((foco) => (
              <FocoRiscoCard
                key={foco.id}
                foco={foco}
                compact
                onAbrirDetalhe={() => navigate(`/gestor/focos/${foco.id}`)}
                onVerNoMapa={() => navigate(`/gestor/mapa?foco=${foco.id}`)}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default Dashboard;
