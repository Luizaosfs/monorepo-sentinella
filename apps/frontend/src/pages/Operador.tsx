import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { api } from '@/services/api';
import { useOperadorSlas } from '@/hooks/queries/useSla';
import { usePagination } from '@/hooks/usePagination';
import TablePagination from '@/components/TablePagination';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Search, Clock, AlertTriangle, CheckCircle2, Timer,
  TrendingUp, BarChart3, LayoutDashboard, ListChecks,
} from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from 'recharts';
import { SlaOperacional, SlaStatus, getSlaVisualStatus, getSlaLocalLabel, getTempoRestante } from '@/types/sla';
import PullToRefresh from '@/components/PullToRefresh';
import { ConcluirSlaDialog } from '@/components/operador/ConcluirSlaDialog';
import { cn } from '@/lib/utils';

/* ── Visual helpers ── */
const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pendente: { label: 'Pendente', color: 'bg-muted text-muted-foreground', icon: Clock },
  em_atendimento: { label: 'Em Atendimento', color: 'bg-info/15 text-info', icon: Timer },
  concluido: { label: 'Concluído', color: 'bg-success/15 text-success', icon: CheckCircle2 },
  vencido: { label: 'Vencido', color: 'bg-destructive/15 text-destructive', icon: AlertTriangle },
};

const visualIndicator: Record<string, { emoji: string; color: string }> = {
  ok: { emoji: '🟢', color: 'text-success' },
  warning: { emoji: '🟡', color: 'text-warning' },
  expired: { emoji: '🔴', color: 'text-destructive' },
};

const OperadorPage = () => {
  const { usuario, isAdmin, isAdminOrSupervisor, papel } = useAuth();
  const { clienteId } = useClienteAtivo();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [concluirDialogOpen, setConcluirDialogOpen] = useState(false);
  const [slaParaConcluir, setSlaParaConcluir] = useState<SlaOperacional | null>(null);

  const isAgente = papel === 'agente';
  const operadorId = isAgente ? (usuario?.id ?? null) : null;

  const { data: slas = [], isLoading: loading, refetch: fetchSlas } = useOperadorSlas(clienteId, operadorId);

  const invalidateSlas = () => queryClient.invalidateQueries({ queryKey: ['sla_panel', clienteId] });

  /* ── Actions ── */
  const updateStatusMutation = useMutation({
    mutationFn: async ({ sla, newStatus }: { sla: SlaOperacional; newStatus: SlaStatus }) => {
      if (newStatus === 'concluido') return 'dialog';

      const updates: Record<string, unknown> = { status: newStatus };
      if (newStatus === 'em_atendimento') {
        if (!sla.operador_id && usuario?.id) updates.operador_id = usuario.id;
        // Cria operação apenas para SLAs de itens pluviométricos
        const cid = sla.cliente_id ?? sla.item?.run?.cliente_id;
        if (cid && sla.item_id && usuario?.id) {
          await api.operacoes.ensureEmAndamento(cid, sla.item_id, usuario.id, sla.prioridade || 'Baixa');
        }
      }
      await api.sla.updateStatus(sla.id, updates);
      return 'updated';
    },
    onSuccess: (result, { sla, newStatus }) => {
      if (result === 'dialog') {
        setSlaParaConcluir(sla);
        setConcluirDialogOpen(true);
        return;
      }
      toast.success(`Status atualizado para ${statusConfig[newStatus]?.label || newStatus}`);
      invalidateSlas();
    },
    onError: () => toast.error('Erro ao atualizar status'),
    onSettled: () => setUpdatingId(null),
  });

  const handleUpdateStatus = (sla: SlaOperacional, newStatus: SlaStatus) => {
    setUpdatingId(sla.id);
    updateStatusMutation.mutate({ sla, newStatus });
  };

  const reabrirMutation = useMutation({
    mutationFn: (slaId: string) => api.sla.reabrir(slaId),
    onSuccess: () => {
      toast.success('SLA reaberto. Item voltou para pendente.');
      invalidateSlas();
    },
    onError: () => toast.error('Erro ao reabrir SLA'),
    onSettled: () => setUpdatingId(null),
  });

  const handleReabrir = (sla: SlaOperacional) => {
    setUpdatingId(sla.id);
    reabrirMutation.mutate(sla.id);
  };

  /* ── Metrics ── */
  const metrics = useMemo(() => {
    const total = slas.length;
    const concluidos = slas.filter(s => s.status === 'concluido');
    const violados = slas.filter(s => s.violado);
    const pendentes = slas.filter(s => s.status === 'pendente' || s.status === 'em_atendimento');
    const criticosAtrasados = slas.filter(s =>
      s.violado && (s.prioridade === 'Crítica' || s.prioridade === 'Urgente')
    );

    const pctCumprido = total > 0 ? Math.round((concluidos.filter(c => !c.violado).length / total) * 100) : 0;
    const pctViolado = total > 0 ? Math.round((violados.length / total) * 100) : 0;

    // Tempo médio de atendimento (em horas)
    const tempos = concluidos
      .filter(c => c.concluido_em)
      .map(c => (new Date(c.concluido_em!).getTime() - new Date(c.inicio).getTime()) / (1000 * 60 * 60));
    const tempoMedio = tempos.length > 0 ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : 0;

    return { total, pctCumprido, pctViolado, tempoMedio, criticosAtrasados: criticosAtrasados.length, pendentes: pendentes.length };
  }, [slas]);

  /* ── Dashboard: urgentes agora ── */
  const urgentes = useMemo(() =>
    slas
      .filter(s => s.status !== 'concluido' && (getSlaVisualStatus(s) !== 'ok' || s.escalonado))
      .sort((a, b) => new Date(a.prazo_final).getTime() - new Date(b.prazo_final).getTime())
      .slice(0, 5),
  [slas]);

  /* ── Dashboard: evolução últimos 7 dias (SLAs concluídos) ── */
  const evolucao = useMemo(() => {
    const days: { label: string; date: string; concluidos: number; noPrazo: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      days.push({
        label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        date: dateStr,
        concluidos: 0,
        noPrazo: 0,
      });
    }
    slas.forEach(s => {
      if (s.status !== 'concluido' || !s.concluido_em) return;
      const d = s.concluido_em.slice(0, 10);
      const entry = days.find(x => x.date === d);
      if (entry) {
        entry.concluidos++;
        if (!s.violado) entry.noPrazo++;
      }
    });
    return days;
  }, [slas]);

  /* ── Dashboard: distribuição dos abertos por prioridade ── */
  const distPrioridade = useMemo(() => {
    const map = new Map<string, number>();
    slas
      .filter(s => s.status === 'pendente' || s.status === 'em_atendimento')
      .forEach(s => map.set(s.prioridade, (map.get(s.prioridade) ?? 0) + 1));
    return Array.from(map.entries())
      .map(([prioridade, count]) => ({ prioridade, count }))
      .sort((a, b) => b.count - a.count);
  }, [slas]);

  /* ── Filtering ── */
  const filteredSlas = useMemo(() => {
    return slas.filter(s => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        getSlaLocalLabel(s).toLowerCase().includes(q) ||
        s.prioridade.toLowerCase().includes(q) ||
        s.status.toLowerCase().includes(q);
      const matchStatus = filterStatus === 'all' || s.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [slas, search, filterStatus]);

  const { page, totalPages, paginated, goTo, next, prev, total } = usePagination(filteredSlas, 15);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={async () => { await fetchSlas(); }}>
      <div className="space-y-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-primary">Painel Operacional</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {usuario?.nome ? `Olá, ${usuario.nome.split(' ')[0]}. ` : ''}
              Acompanhe seus SLAs e desempenho operacional.
            </p>
          </div>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList className="grid w-full max-w-xs grid-cols-2">
            <TabsTrigger value="dashboard" className="gap-1.5 text-xs">
              <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="slas" className="gap-1.5 text-xs">
              <ListChecks className="w-3.5 h-3.5" /> SLAs
              {metrics.pendentes > 0 && (
                <Badge className="ml-1 h-4 px-1 text-[9px] bg-warning text-warning-foreground">{metrics.pendentes}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Tab: Dashboard ── */}
          <TabsContent value="dashboard" className="space-y-4">

            {/* KPI Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Cumprimento */}
              <Card className="stat-card col-span-2 lg:col-span-1">
                <CardContent className="p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Taxa de Cumprimento</p>
                  <p className={cn('text-3xl font-black tabular-nums mt-1',
                    metrics.pctCumprido >= 80 ? 'text-success' : metrics.pctCumprido >= 50 ? 'text-warning' : 'text-destructive'
                  )}>
                    {metrics.pctCumprido}%
                  </p>
                  <Progress value={metrics.pctCumprido} className="mt-2 h-1.5" />
                  <p className="text-[10px] text-muted-foreground mt-1">SLAs concluídos no prazo</p>
                </CardContent>
              </Card>

              <MetricCard title="Pendentes" value={metrics.pendentes} icon={Clock} color="text-warning" />
              <MetricCard title="Tempo Médio" value={`${metrics.tempoMedio}h`} icon={TrendingUp} color="text-primary" />
              <MetricCard title="Críticos Atrasados" value={metrics.criticosAtrasados} icon={AlertTriangle} color="text-destructive" />
            </div>

            {/* Urgentes agora */}
            {urgentes.length > 0 && (
              <Card className="card-premium border-warning/30">
                <CardHeader className="p-4 pb-3 border-b border-border/40">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-warning" />
                    {urgentes.length} SLA{urgentes.length !== 1 ? 's' : ''} urgente{urgentes.length !== 1 ? 's' : ''} agora
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 divide-y divide-border/40">
                  {urgentes.map(sla => {
                    const visual = getSlaVisualStatus(sla);
                    return (
                      <div key={sla.id} className={cn(
                        'flex items-center justify-between px-4 py-3 gap-3',
                        visual === 'expired' ? 'bg-destructive/5' : 'bg-warning/5'
                      )}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base shrink-0">{visual === 'expired' ? '🔴' : '🟡'}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate flex items-center gap-1">
                              {sla.escalonado && <span className="text-destructive text-[10px]">🔺</span>}
                              {getSlaLocalLabel(sla)}
                            </p>
                            <p className="text-[10px] text-muted-foreground">{sla.prioridade} · SLA {sla.sla_horas}h</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cn('text-xs font-bold tabular-nums', visual === 'expired' ? 'text-destructive' : 'text-warning')}>
                            {getTempoRestante(sla.prazo_final)}
                          </span>
                          <SlaActions sla={sla} onUpdate={handleUpdateStatus} onReabrir={handleReabrir} loading={updatingId === sla.id} isAgente={isAgente} isAdmin={isAdminOrSupervisor} />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Evolução semanal */}
              <Card className="card-premium">
                <CardHeader className="p-4 pb-2 border-b border-border/40">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    Concluídos — últimos 7 dias
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  {evolucao.every(d => d.concluidos === 0) ? (
                    <p className="text-center text-muted-foreground text-sm py-8">Nenhum SLA concluído nos últimos 7 dias.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={evolucao} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{ fontSize: 11, borderRadius: 8 }}
                          formatter={(v: number, name: string) => [v, name === 'concluidos' ? 'Concluídos' : 'No prazo']}
                        />
                        <Bar dataKey="concluidos" name="concluidos" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="noPrazo" name="noPrazo" fill="hsl(var(--success, 142 76% 36%))" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                  <div className="flex items-center gap-4 mt-2 justify-center">
                    <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span className="w-2.5 h-2.5 rounded-sm bg-primary inline-block" /> Concluídos
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span className="w-2.5 h-2.5 rounded-sm bg-success inline-block" /> No prazo
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Distribuição por prioridade */}
              <Card className="card-premium">
                <CardHeader className="p-4 pb-2 border-b border-border/40">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Timer className="w-4 h-4 text-primary" />
                    Abertos por prioridade
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  {distPrioridade.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-8">Nenhum SLA aberto no momento.</p>
                  ) : (
                    <div className="space-y-3 mt-1">
                      {distPrioridade.map(({ prioridade, count }) => {
                        const max = distPrioridade[0].count;
                        const pct = Math.round((count / max) * 100);
                        const color =
                          ['Crítica', 'Urgente'].includes(prioridade) ? 'bg-destructive' :
                          prioridade === 'Alta' ? 'bg-orange-500' :
                          ['Média', 'Moderada'].includes(prioridade) ? 'bg-warning' : 'bg-primary';
                        return (
                          <div key={prioridade} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold">{prioridade}</span>
                              <span className="tabular-nums text-muted-foreground font-bold">{count}</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                              <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Tab: SLAs ── */}
          <TabsContent value="slas" className="space-y-4">
            {/* Filters */}
            <Card className="card-premium">
              <CardContent className="p-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por local, prioridade..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Filtrar status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="em_atendimento">Em Atendimento</SelectItem>
                      <SelectItem value="concluido">Concluído</SelectItem>
                      <SelectItem value="vencido">Vencido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Table */}
            <Card className="card-premium overflow-hidden">
              <CardHeader className="p-3 border-b border-border/40">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-primary">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  {total} registro{total !== 1 ? 's' : ''}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {/* Desktop */}
                <div className="hidden lg:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Local</TableHead>
                        <TableHead>Prioridade</TableHead>
                        <TableHead>SLA</TableHead>
                        <TableHead>Prazo</TableHead>
                        <TableHead>Restante</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Agente</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginated.map((sla) => {
                        const visual = getSlaVisualStatus(sla);
                        const indicator = visualIndicator[visual];
                        const cfg = statusConfig[sla.status] || statusConfig.pendente;
                        return (
                          <TableRow key={sla.id} className={cn(visual === 'expired' && 'bg-destructive/5')}>
                            <TableCell className="text-center text-lg">{indicator.emoji}</TableCell>
                            <TableCell className="font-medium">
                              <span className="flex items-center gap-1">
                                {sla.escalonado && <span title={`Era ${sla.prioridade_original}`} className="text-destructive">🔺</span>}
                                {getSlaLocalLabel(sla)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px] font-bold">{sla.prioridade}</Badge>
                              {sla.escalonado && sla.prioridade_original && (
                                <span className="text-[9px] text-muted-foreground ml-1 line-through">{sla.prioridade_original}</span>
                              )}
                            </TableCell>
                            <TableCell className="tabular-nums text-xs">{sla.sla_horas}h</TableCell>
                            <TableCell className="text-xs">
                              {new Date(sla.prazo_final).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </TableCell>
                            <TableCell className={cn('text-xs font-semibold', indicator.color)}>
                              {sla.status === 'concluido' ? '—' : getTempoRestante(sla.prazo_final)}
                            </TableCell>
                            <TableCell>
                              <Badge className={cn('text-[10px] font-bold border-0', cfg.color)}>{cfg.label}</Badge>
                            </TableCell>
                            <TableCell className="text-xs">{sla.operador?.nome || '—'}</TableCell>
                            <TableCell className="text-right">
                              <SlaActions sla={sla} onUpdate={handleUpdateStatus} onReabrir={handleReabrir} loading={updatingId === sla.id} isAgente={isAgente} isAdmin={isAdminOrSupervisor} />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {paginated.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                            Nenhum SLA encontrado.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile */}
                <div className="lg:hidden divide-y divide-border/40">
                  {paginated.map(sla => {
                    const visual = getSlaVisualStatus(sla);
                    const indicator = visualIndicator[visual];
                    const cfg = statusConfig[sla.status] || statusConfig.pendente;
                    return (
                      <div key={sla.id} className={cn('p-3 space-y-1.5', visual === 'expired' && 'bg-destructive/5')}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{indicator.emoji}</span>
                            <span className="font-semibold text-sm flex items-center gap-1">
                              {sla.escalonado && <span className="text-destructive">🔺</span>}
                              {getSlaLocalLabel(sla)}
                            </span>
                          </div>
                          <Badge className={cn('text-[10px] font-bold border-0', cfg.color)}>{cfg.label}</Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Prioridade: <strong className="text-foreground">{sla.prioridade}</strong></span>
                          <span>SLA: <strong className="text-foreground">{sla.sla_horas}h</strong></span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className={cn('font-semibold', indicator.color)}>
                            {sla.status === 'concluido' ? 'Concluído' : getTempoRestante(sla.prazo_final)}
                          </span>
                          <span className="text-muted-foreground">{sla.operador?.nome || 'Sem agente'}</span>
                        </div>
                        <div className="flex justify-end">
                          <SlaActions sla={sla} onUpdate={handleUpdateStatus} onReabrir={handleReabrir} loading={updatingId === sla.id} isAgente={isAgente} isAdmin={isAdminOrSupervisor} />
                        </div>
                      </div>
                    );
                  })}
                  {paginated.length === 0 && (
                    <div className="text-center py-10 text-muted-foreground text-sm">Nenhum SLA encontrado.</div>
                  )}
                </div>
              </CardContent>
            </Card>

            {totalPages > 1 && (
              <TablePagination page={page} totalPages={totalPages} total={total} onGoTo={goTo} onNext={next} onPrev={prev} />
            )}
          </TabsContent>
        </Tabs>

        <ConcluirSlaDialog
          open={concluirDialogOpen}
          onOpenChange={setConcluirDialogOpen}
          sla={slaParaConcluir}
          usuarioId={usuario?.id ?? null}
          onSuccess={fetchSlas}
        />
      </div>
    </PullToRefresh>
  );
};

/* ── SLA Actions ── */
function SlaActions({ sla, onUpdate, onReabrir, loading, isAgente, isAdmin }: {
  sla: SlaOperacional;
  onUpdate: (sla: SlaOperacional, status: SlaStatus) => void;
  onReabrir: (sla: SlaOperacional) => void;
  loading: boolean;
  isAgente: boolean;
  isAdmin: boolean;
}) {
  if (sla.status === 'vencido') return null;

  if (sla.status === 'concluido') {
    if (!isAdmin) return null;
    return (
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-[10px] font-bold"
        disabled={loading}
        onClick={() => onReabrir(sla)}
      >
        Reabrir
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      {sla.status === 'pendente' && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[10px] font-bold"
          disabled={loading}
          onClick={() => onUpdate(sla, 'em_atendimento')}
        >
          Iniciar
        </Button>
      )}
      {sla.status === 'em_atendimento' && (
        <Button
          size="sm"
          className="h-7 text-[10px] font-bold bg-success hover:bg-success/90 text-success-foreground"
          disabled={loading}
          onClick={() => onUpdate(sla, 'concluido')}
        >
          Concluir
        </Button>
      )}
    </div>
  );
}

/* ── Metric Card ── */
function MetricCard({ title, value, icon: Icon, color }: {
  title: string;
  value: string | number;
  icon: typeof Clock;
  color: string;
}) {
  return (
    <Card className="stat-card">
      <CardContent className="p-3 flex items-center gap-2">
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', color.replace('text-', 'bg-') + '/10')}>
          <Icon className={cn('w-4 h-4', color)} />
        </div>
        <div className="min-w-0">
          <p className={cn('text-[10px] font-bold uppercase tracking-wider', color)}>{title}</p>
          <p className="text-lg font-black tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default OperadorPage;
