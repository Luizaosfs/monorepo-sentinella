import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  CheckCircle2, XCircle, AlertTriangle, Loader2, RefreshCw,
  Calendar, Users, Map, ClipboardList, Zap, ArrowRight, Info,
  Building2, PlayCircle, Home,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  useImplantacaoOperacionalStatus,
  useIniciarImplantacaoOperacional,
  useGerarOperacaoInicial,
} from '@/hooks/queries/useImplantacaoOperacional';

function StatusIcon({ ok, loading }: { ok: boolean; loading?: boolean }) {
  if (loading) return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />;
  return ok
    ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
    : <XCircle className="w-5 h-5 text-red-500 shrink-0" />;
}

function SectionCard({
  icon: Icon, title, ok, loading, children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  ok: boolean;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn('border-border/70 transition-colors', !ok && !loading && 'border-red-200 dark:border-red-900/40')}>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <span className="flex-1">{title}</span>
          <StatusIcon ok={ok} loading={loading} />
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {children}
      </CardContent>
    </Card>
  );
}

function StatRow({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-semibold tabular-nums', highlight && 'text-red-500')}>{value}</span>
    </div>
  );
}

export default function GestorImplantacaoOperacional() {
  const navigate = useNavigate();
  const { data: status, isLoading, refetch } = useImplantacaoOperacionalStatus();
  const iniciarMutation = useIniciarImplantacaoOperacional();
  const gerarMutation = useGerarOperacaoInicial();

  const handleIniciar = async () => {
    try {
      await iniciarMutation.mutateAsync();
      toast.success('Planejamento inicial criado. Operação de campo liberada!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao iniciar operação';
      toast.error(msg);
    }
  };

  const handleGerarOperacao = async () => {
    try {
      const result = await gerarMutation.mutateAsync();
      toast.success(result.mensagem);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar operação inicial';
      toast.error(msg);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
        <AlertTriangle className="w-8 h-8 mb-2 opacity-40" />
        <p className="text-sm">Não foi possível carregar o diagnóstico operacional.</p>
        <Button variant="ghost" size="sm" className="mt-3" onClick={() => refetch()}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Tentar novamente
        </Button>
      </div>
    );
  }

  const { ciclo_ativo, territorio, agentes, planejamento_inicial, operacao_inicial, operacao } = status;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">

      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Implantação Operacional</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Checklist para iniciar operação de campo no município.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Atualizar
        </Button>
      </div>

      {/* Painel de status geral */}
      <Card className={cn(
        'border-2',
        operacao.pode_iniciar
          ? 'border-green-400 bg-green-50/50 dark:bg-green-950/20'
          : 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/20',
      )}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            {operacao.pode_iniciar
              ? <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" />
              : <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />}
            <div className="flex-1">
              <p className={cn('font-semibold text-sm',
                operacao.pode_iniciar ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400',
              )}>
                {operacao.pode_iniciar
                  ? 'Município pronto para operação de campo'
                  : `${operacao.bloqueios.length} pendência(s) antes de iniciar`}
              </p>
              {operacao.proximas_acoes.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {operacao.proximas_acoes.map((a, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <ArrowRight className="w-3 h-3 shrink-0" />{a}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid checklist */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* 1. Ciclo ativo */}
        <SectionCard icon={Calendar} title="Ciclo Ativo" ok={ciclo_ativo.existe} loading={isLoading}>
          {ciclo_ativo.existe ? (
            <>
              <StatRow label="Número" value={`Ciclo ${ciclo_ativo.numero} / ${ciclo_ativo.ano}`} />
              <StatRow label="Status" value={ciclo_ativo.status ?? '—'} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum ciclo ativo encontrado.</p>
          )}
          <Button
            variant="outline" size="sm" className="w-full mt-1"
            onClick={() => navigate('/gestor/ciclos')}
          >
            {ciclo_ativo.existe ? 'Gerenciar ciclos' : 'Criar ciclo'}
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </SectionCard>

        {/* 2. Distribuição territorial */}
        <SectionCard
          icon={Map}
          title="Distribuição Territorial"
          ok={territorio.quarteiroes_com_agente > 0}
          loading={isLoading}
        >
          <StatRow label="Total quarteirões" value={territorio.total_quarteiroes} />
          <StatRow label="Com agente" value={territorio.quarteiroes_com_agente} />
          <StatRow label="Sem agente" value={territorio.quarteiroes_sem_agente} highlight={territorio.quarteiroes_sem_agente > 0} />
          {territorio.total_quarteiroes > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Distribuição</span>
                <span className="font-medium">{territorio.percentual_distribuido}%</span>
              </div>
              <Progress value={territorio.percentual_distribuido} className="h-1.5" />
            </div>
          )}
          <Button
            variant="outline" size="sm" className="w-full mt-1"
            onClick={() => navigate('/gestor/distribuicao-quarteirao')}
          >
            Distribuir quarteirões
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </SectionCard>

        {/* 3. Agentes */}
        <SectionCard icon={Users} title="Agentes de Campo" ok={agentes.total_agentes_ativos > 0} loading={isLoading}>
          <StatRow label="Total ativos" value={agentes.total_agentes_ativos} />
          <StatRow label="Com quarteirão" value={agentes.agentes_com_quarteirao} />
          <StatRow label="Sem quarteirão" value={agentes.agentes_sem_quarteirao} highlight={agentes.agentes_sem_quarteirao > 0} />
          <Button
            variant="outline" size="sm" className="w-full mt-1"
            onClick={() => navigate('/operador/usuarios')}
          >
            Gerenciar agentes
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </SectionCard>

        {/* 4. Planejamento inicial */}
        <SectionCard
          icon={ClipboardList}
          title="Planejamento Inicial"
          ok={planejamento_inicial.existe}
          loading={isLoading}
        >
          {planejamento_inicial.existe ? (
            <>
              <StatRow label="Nome" value={planejamento_inicial.nome ?? '—'} />
              <StatRow label="Ativo" value={planejamento_inicial.ativo ? 'Sim' : 'Não'} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum planejamento manual encontrado.
            </p>
          )}
          <Button
            variant="outline" size="sm" className="w-full mt-1"
            onClick={() => navigate('/gestor/planejamentos')}
          >
            {planejamento_inicial.existe ? 'Ver planejamentos' : 'Criar manualmente'}
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Button>
        </SectionCard>
      </div>

      {/* Ação principal — Iniciar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Button
          size="lg"
          className="w-full sm:w-auto gap-2"
          disabled={!operacao.pode_iniciar || iniciarMutation.isPending}
          onClick={handleIniciar}
        >
          {iniciarMutation.isPending
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Zap className="w-4 h-4" />}
          {planejamento_inicial.existe ? 'Operação já iniciada — verificar' : 'Iniciar operação de campo'}
        </Button>

        {!operacao.pode_iniciar && operacao.bloqueios.length > 0 && (
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>Resolva os {operacao.bloqueios.length} bloqueio(s) acima para liberar este botão.</span>
          </div>
        )}
      </div>

      {/* Bloqueios do podeIniciar */}
      {operacao.bloqueios.length > 0 && (
        <Card className="border-red-200 dark:border-red-900/40 bg-red-50/30 dark:bg-red-950/10">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wider">Bloqueios — Pré-requisitos</p>
            {operacao.bloqueios.map((b, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
                <XCircle className="w-3.5 h-3.5 shrink-0" />
                {b}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* ── OPERAÇÃO INICIAL ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-base font-semibold tracking-tight">Operação Inicial de Campo</h2>
          {operacao_inicial.existe
            ? <Badge variant="default" className="bg-green-600 text-white text-xs">Gerada</Badge>
            : <Badge variant="secondary" className="text-xs">Pendente</Badge>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Imóveis elegíveis */}
          <Card className={cn('border-border/70', operacao_inicial.total_imoveis_elegiveis === 0 && 'border-amber-200 dark:border-amber-900/40')}>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Home className="w-4 h-4 text-muted-foreground" />
                Imóveis
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              <StatRow label="Elegíveis (nos quarteirões)" value={operacao_inicial.total_imoveis_elegiveis} />
              <StatRow label="Já visitados no ciclo" value={operacao_inicial.total_imoveis_ja_visitados_no_ciclo} />
              <StatRow
                label="Pendentes"
                value={operacao_inicial.total_imoveis_pendentes}
                highlight={operacao_inicial.total_imoveis_pendentes > 0}
              />
              {operacao_inicial.total_imoveis_elegiveis > 0 && (
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progresso do ciclo</span>
                    <span className="font-medium">
                      {operacao_inicial.total_imoveis_elegiveis > 0
                        ? Math.round((operacao_inicial.total_imoveis_ja_visitados_no_ciclo / operacao_inicial.total_imoveis_elegiveis) * 100)
                        : 0}%
                    </span>
                  </div>
                  <Progress
                    value={operacao_inicial.total_imoveis_elegiveis > 0
                      ? Math.round((operacao_inicial.total_imoveis_ja_visitados_no_ciclo / operacao_inicial.total_imoveis_elegiveis) * 100)
                      : 0}
                    className="h-1.5"
                  />
                </div>
              )}
              {operacao_inicial.total_imoveis_elegiveis === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Nenhum imóvel nos quarteirões distribuídos. Cadastre imóveis para gerar a operação.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Agentes com rota */}
          <Card className="border-border/70">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Users className="w-4 h-4 text-muted-foreground" />
                Cobertura de Agentes
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              <StatRow label="Com rota atribuída" value={operacao_inicial.agentes_com_rota_inicial} />
              <StatRow
                label="Sem rota atribuída"
                value={operacao_inicial.agentes_sem_rota_inicial}
                highlight={operacao_inicial.agentes_sem_rota_inicial > 0}
              />
              {operacao_inicial.agentes_sem_rota_inicial > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  {operacao_inicial.agentes_sem_rota_inicial} agente(s) sem quarteirão distribuído.
                </p>
              )}
              <Button
                variant="outline" size="sm" className="w-full mt-1"
                onClick={() => navigate('/gestor/distribuicao-quarteirao')}
              >
                Distribuir quarteirões
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Bloqueios da operação inicial */}
        {operacao_inicial.bloqueios.length > 0 && (
          <Card className="mt-4 border-amber-200 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/10">
            <CardContent className="p-4 space-y-2">
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Bloqueios — Operação Inicial</p>
              {operacao_inicial.bloqueios.map((b, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {b}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Botão gerar operação inicial */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mt-4">
          <Button
            size="lg"
            variant={operacao_inicial.existe ? 'outline' : 'default'}
            className="w-full sm:w-auto gap-2"
            disabled={!operacao_inicial.pode_gerar || gerarMutation.isPending}
            onClick={handleGerarOperacao}
          >
            {gerarMutation.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <PlayCircle className="w-4 h-4" />}
            {operacao_inicial.existe ? 'Regenerar operação inicial' : 'Gerar operação inicial'}
          </Button>

          {operacao_inicial.existe && (
            <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Operação já gerada — agentes podem iniciar vistorias pelos quarteirões distribuídos.
            </p>
          )}

          {!operacao_inicial.pode_gerar && operacao_inicial.bloqueios.length > 0 && (
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>Resolva os bloqueios acima para gerar a operação inicial.</span>
            </div>
          )}
        </div>
      </div>

      {/* Badge de papel */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="secondary">supervisor</Badge>
        <span>Esta página é exclusiva para o supervisor municipal.</span>
      </div>
    </div>
  );
}
