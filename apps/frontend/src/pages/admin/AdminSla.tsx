import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/services/api';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { usePagination } from '@/hooks/usePagination';
import TablePagination from '@/components/TablePagination';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Search, Loader2, UserPlus, Clock, AlertTriangle, CheckCircle2, Timer, RefreshCw, Trophy, Medal, FileDown, Settings2, ArrowUpRight, PlayCircle, TrendingUp, MapPin, Info,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { SlaOperacional, getSlaVisualStatus, getSlaLocalLabel, getSlaOrigem, getTempoRestante } from '@/types/sla';
import AdminPageHeader from '@/components/AdminPageHeader';
import MobileListCard from '@/components/admin/MobileListCard';
import { exportSlaPdf } from '@/lib/slaPdf';
import SlaConfigTab from '@/components/sla/SlaConfigTab';
import SlaAuditLog from '@/components/sla/SlaAuditLog';
import SlaRegioesTab from '@/components/sla/SlaRegioesTab';

/* ── Visual helpers ── */
const statusBadge: Record<string, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: 'bg-muted text-muted-foreground' },
  em_atendimento: { label: 'Em Atendimento', color: 'bg-info/15 text-info' },
  concluido: { label: 'Concluído', color: 'bg-success/15 text-success' },
  vencido: { label: 'Vencido', color: 'bg-destructive/15 text-destructive' },
};

const visualEmoji: Record<string, string> = { ok: '🟢', warning: '🟡', expired: '🔴' };

function formatSlaHoras(horas: number): string {
  if (horas >= 48 && horas % 24 === 0) return `${horas / 24} dias`;
  if (horas >= 24) return `${horas}h (${Math.round(horas / 24)} d)`;
  return `${horas}h`;
}

interface Operador {
  id: string;
  nome: string;
  email: string;
}

const AdminSla = () => {
  const { isAdmin } = useAuth();
  const { clienteId, clienteAtivo } = useClienteAtivo();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [showErros, setShowErros] = useState(false);

  /* ── QW-09: Erros de criação de SLA ── */
  const { data: errosCriacao = [] } = useQuery({
    queryKey: ['sla_erros_criacao', clienteId],
    queryFn: () => (clienteId ? api.sla.errosCriacao(clienteId) : Promise.resolve([])),
    enabled: !!clienteId,
    staleTime: 60_000,
  });

  /* ── Fetch runs ── */
  const { data: runs = [] } = useQuery({
    queryKey: ['admin_sla_runs', clienteId],
    queryFn: async () => {
      if (!clienteId) return [];
      const list = await api.sla.listRunsByCliente(clienteId);
      setSelectedRunId(prev => (prev && list.some(r => r.id === prev) ? prev : (list[0]?.id || '')));
      return list;
    },
    staleTime: 0,
  });

  /* ── Fetch SLAs + operadores ── */
  const { data, isLoading: loading } = useQuery({
    queryKey: ['admin_sla', clienteId],
    queryFn: async () => {
      const [slas, operadores] = await Promise.all([
        api.sla.listWithJoins(clienteId ?? null),
        api.sla.listOperadoresByCliente(clienteId ?? null),
      ]);
      return { slas, operadores: operadores as Operador[] };
    },
    staleTime: 0,
  });

  const slas = data?.slas ?? [];
  const operadores = data?.operadores ?? [];

  /* ── Gerar SLAs (RPC) ── */
  const handleGerarSlas = async () => {
    if (!selectedRunId) { toast.error('Selecione um run'); return; }
    setGenerating(true);
    try {
      const count = await api.sla.gerarSlas(selectedRunId);
      toast.success(count > 0 ? `${count} SLA(s) criado(s) com sucesso.` : 'Nenhum item novo para gerar SLA (todos já possuem SLA aberto).');
      queryClient.invalidateQueries({ queryKey: ['admin_sla', clienteId] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao gerar SLAs');
    } finally {
      setGenerating(false);
    }
  };

  /* ── Atribuir operador ── */
  const assignMutation = useMutation({
    mutationFn: async ({ slaId, operadorId }: { slaId: string; operadorId: string }) => {
      const sla = slas.find(s => s.id === slaId);
      const avancar = !!operadorId && sla?.status === 'pendente';
      await api.sla.atribuirOperador(slaId, operadorId, avancar);
      return operadorId;
    },
    onSuccess: (operadorId, { slaId }) => {
      setUpdatingId(null);
      toast.success(operadorId ? 'Agente atribuído' : 'Atribuição removida');
      queryClient.invalidateQueries({ queryKey: ['admin_sla', clienteId] });
    },
    onError: () => { setUpdatingId(null); toast.error('Erro ao atribuir agente'); },
  });

  const handleAssign = (slaId: string, operadorId: string) => {
    setUpdatingId(slaId);
    assignMutation.mutate({ slaId, operadorId });
  };

  /* ── Forçar status ── */
  const statusMutation = useMutation({
    mutationFn: async ({ slaId, status }: { slaId: string; status: string }) => {
      if (status === 'concluido') {
        const sla = slas.find(s => s.id === slaId);
        const violado = !!sla && new Date() > new Date(sla.prazo_final);
        await api.sla.concluirManualmente(slaId, violado);
      } else {
        await api.sla.updateStatus(slaId, { status });
      }
    },
    onSuccess: () => {
      setUpdatingId(null);
      toast.success('Status atualizado');
      queryClient.invalidateQueries({ queryKey: ['admin_sla', clienteId] });
    },
    onError: () => { setUpdatingId(null); toast.error('Erro ao atualizar status'); },
  });

  const handleForceStatus = (slaId: string, status: string) => {
    setUpdatingId(slaId);
    statusMutation.mutate({ slaId, status });
  };

  const reabrirMutation = useMutation({
    mutationFn: (slaId: string) => api.sla.reabrir(slaId),
    onSuccess: () => {
      setUpdatingId(null);
      toast.success('SLA reaberto. Item voltou para pendente.');
      queryClient.invalidateQueries({ queryKey: ['admin_sla', clienteId] });
    },
    onError: () => {
      setUpdatingId(null);
      toast.error('Erro ao reabrir SLA');
    },
  });

  const escalarMutation = useMutation({
    mutationFn: (slaId: string) => api.sla.escalar(slaId),
    onSuccess: (result, slaId) => {
      setUpdatingId(null);
      if (result.escalado) {
        toast.success(`SLA escalado para ${result.prioridade_nova} (${result.sla_horas}h)`);
      } else {
        toast.info(result.mensagem || 'Prioridade já está no nível máximo.');
      }
      queryClient.invalidateQueries({ queryKey: ['admin_sla', clienteId] });
    },
    onError: () => {
      setUpdatingId(null);
      toast.error('Erro ao escalar SLA');
    },
  });

  const handleEscalar = (slaId: string) => {
    setUpdatingId(slaId);
    escalarMutation.mutate(slaId);
  };

  const handleReabrir = (slaId: string) => {
    setUpdatingId(slaId);
    reabrirMutation.mutate(slaId);
  };

  /* ── Metrics ── */
  const metrics = useMemo(() => {
    const total = slas.length;
    const semOperador = slas.filter(s => !s.agente_id && s.status !== 'concluido').length;
    const violados = slas.filter(s => s.violado).length;
    const pendentes = slas.filter(s => s.status === 'pendente').length;
    const escalonados = slas.filter(s => s.escalonado).length;
    return { total, semOperador, violados, pendentes, escalonados };
  }, [slas]);

  /* ── Ranking ── */
  const ranking = useMemo(() => {
    const map = new Map<string, {
      nome: string;
      total: number;
      concluidos: number;
      violados: number;
      noPrazo: number;
      tempoTotal: number;
    }>();

    slas.forEach(s => {
      if (!s.agente_id || !s.agente) return;
      const key = s.agente_id;
      if (!map.has(key)) {
        map.set(key, { nome: s.agente.nome, total: 0, concluidos: 0, violados: 0, noPrazo: 0, tempoTotal: 0 });
      }
      const entry = map.get(key)!;
      entry.total++;
      if (s.status === 'concluido') {
        entry.concluidos++;
        if (!s.violado) entry.noPrazo++;
        if (s.concluido_em) {
          entry.tempoTotal += (new Date(s.concluido_em).getTime() - new Date(s.inicio).getTime()) / (1000 * 60 * 60);
        }
      }
      if (s.violado) entry.violados++;
    });

    return Array.from(map.entries())
      .map(([id, d]) => ({
        id,
        nome: d.nome,
        total: d.total,
        concluidos: d.concluidos,
        violados: d.violados,
        pctCumprido: d.total > 0 ? Math.round((d.noPrazo / d.total) * 100) : 0,
        tempoMedio: d.concluidos > 0 ? Math.round(d.tempoTotal / d.concluidos) : 0,
      }))
      .sort((a, b) => b.pctCumprido - a.pctCumprido || a.tempoMedio - b.tempoMedio);
  }, [slas]);

  /* ── Filter ── */
  const filteredSlas = useMemo(() => {
    return slas.filter(s => {
      const q = search.toLowerCase();
      const label = getSlaLocalLabel(s).toLowerCase();
      const matchSearch = !q ||
        label.includes(q) ||
        s.prioridade.toLowerCase().includes(q) ||
        s.agente?.nome?.toLowerCase().includes(q) ||
        s.levantamento_item?.item?.toLowerCase().includes(q);
      const matchStatus = filterStatus === 'all'
        ? true
        : filterStatus === 'sem_operador'
          ? !s.agente_id && s.status !== 'concluido'
          : filterStatus === 'escalonado'
            ? s.escalonado
            : s.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [slas, search, filterStatus]);

  const { page, totalPages, paginated, goTo, next, prev, total, pageSize, setPageSize } = usePagination(filteredSlas, 15);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <AdminPageHeader
        title="Gestão de SLA"
        description="Atribua operadores, gerencie prazos e configure regras de SLA."
        icon={Timer}
      />

      {/* QW-09 Correção 1: Banner de erros de criação de SLA */}
      {errosCriacao.length > 0 && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {errosCriacao.length} erro{errosCriacao.length > 1 ? 's' : ''} de criação de SLA detectado{errosCriacao.length > 1 ? 's' : ''}
            </div>
            <button
              onClick={() => setShowErros((v) => !v)}
              className="text-xs text-destructive underline underline-offset-2 shrink-0"
            >
              {showErros ? 'Ocultar' : 'Ver detalhes'}
            </button>
          </div>
          {showErros && (
            <ul className="mt-2 space-y-1">
              {errosCriacao.map((e) => (
                <li key={e.id} className="text-xs text-destructive/80 font-mono">
                  {new Date(e.criado_em).toLocaleString('pt-BR')} — {e.erro}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Tabs defaultValue="gestao" className="space-y-5">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="gestao" className="gap-1.5 text-xs">
            <Timer className="w-3.5 h-3.5" /> Gestão
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-1.5 text-xs">
            <Settings2 className="w-3.5 h-3.5" /> Configuração
          </TabsTrigger>
          <TabsTrigger value="regioes" className="gap-1.5 text-xs">
            <MapPin className="w-3.5 h-3.5" /> Por Região
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5 text-xs">
            <Clock className="w-3.5 h-3.5" /> Histórico
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Gestão ── */}
        <TabsContent value="gestao" className="space-y-5">
          {/* Gerar SLAs a partir de run */}
          {clienteId && (
            <Card className="card-premium border-primary/20 bg-primary/5">
              <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <PlayCircle className="w-4 h-4 text-primary" />
                  Gerar SLAs a partir de run pluviométrico
                </div>
                <Select value={selectedRunId} onValueChange={setSelectedRunId}>
                  <SelectTrigger className="w-full sm:w-56 h-9 text-xs">
                    <SelectValue placeholder="Selecione o run" />
                  </SelectTrigger>
                  <SelectContent>
                    {runs.map(r => (
                      <SelectItem key={r.id} value={r.id} className="text-xs">
                        {new Date(r.dt_ref).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="gap-2 font-semibold"
                  onClick={handleGerarSlas}
                  disabled={generating || !selectedRunId || runs.length === 0}
                >
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                  Gerar SLAs
                </Button>
                {runs.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum run pluviométrico para este cliente.</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Summary bar */}
          <TooltipProvider delayDuration={300}>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <SummaryCard label="Total SLAs" value={metrics.total} icon={Timer} color="text-primary" tooltip="Total de SLAs cadastrados para este cliente, incluindo todos os status." />
              <SummaryCard label="Sem Agente" value={metrics.semOperador} icon={UserPlus} color="text-warning" tooltip="SLAs abertos (não concluídos) que ainda não têm um agente de campo atribuído. Requerem ação imediata." />
              <SummaryCard label="Pendentes" value={metrics.pendentes} icon={Clock} color="text-muted-foreground" tooltip="SLAs com status 'pendente' — criados mas ainda não iniciados por nenhum agente." />
              <SummaryCard label="Violados" value={metrics.violados} icon={AlertTriangle} color="text-destructive" tooltip="SLAs cujo prazo foi ultrapassado sem conclusão. Cada violação pode impactar o indicador de cumprimento do cliente." />
              <SummaryCard label="Escalonados" value={metrics.escalonados} icon={ArrowUpRight} color="text-destructive" tooltip="SLAs que tiveram a prioridade elevada automaticamente após persistência sem resolução. Exigem atenção urgente." />
            </div>
          </TooltipProvider>

          {/* Ranking */}
          {ranking.length > 0 && (
            <Card className="card-premium overflow-hidden">
              <CardHeader className="p-4 pb-3 border-b border-border/40 bg-muted/20">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-primary" />
                  Ranking de Agentes
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/40">
                  {ranking.map((op, idx) => {
                    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
                    return (
                      <div key={op.id} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors">
                        <div className="w-8 text-center shrink-0">
                          {medal ? (
                            <span className="text-lg">{medal}</span>
                          ) : (
                            <span className="text-sm font-bold text-muted-foreground">{idx + 1}º</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                            {op.nome.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{op.nome}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {op.concluidos}/{op.total} concluído{op.concluidos !== 1 ? 's' : ''} · {op.tempoMedio}h média
                            </p>
                          </div>
                        </div>
                        <div className="hidden sm:flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className="text-[10px] text-muted-foreground">Cumprimento</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Progress value={op.pctCumprido} className="w-20 h-1.5" />
                              <span className={cn(
                                'text-xs font-bold tabular-nums',
                                op.pctCumprido >= 80 ? 'text-success' : op.pctCumprido >= 50 ? 'text-warning' : 'text-destructive'
                              )}>
                                {op.pctCumprido}%
                              </span>
                            </div>
                          </div>
                          {op.violados > 0 && (
                            <Badge variant="outline" className="text-[9px] font-bold text-destructive border-destructive/30">
                              {op.violados} violado{op.violados !== 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                        <div className="sm:hidden text-right shrink-0">
                          <span className={cn(
                            'text-sm font-bold tabular-nums',
                            op.pctCumprido >= 80 ? 'text-success' : op.pctCumprido >= 50 ? 'text-warning' : 'text-destructive'
                          )}>
                            {op.pctCumprido}%
                          </span>
                          <p className="text-[9px] text-muted-foreground">cumprido</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filter bar */}
          <Card className="card-premium">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar bairro, prioridade, operador..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-full sm:w-52">
                    <SelectValue placeholder="Filtrar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="sem_operador">⚠ Sem agente</SelectItem>
                    <SelectItem value="escalonado">🔺 Escalonados</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="em_atendimento">Em Atendimento</SelectItem>
                    <SelectItem value="concluido">Concluído</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: ['admin_sla', clienteId] })} title="Atualizar">
                  <RefreshCw className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 text-xs font-bold"
                  onClick={() => exportSlaPdf(slas, ranking, metrics, clienteAtivo?.nome)}
                >
                  <FileDown className="w-4 h-4" />
                  <span className="hidden sm:inline">Exportar PDF</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card className="card-premium overflow-hidden">
            <CardHeader className="p-4 border-b border-border/40">
              <CardTitle className="text-sm font-semibold">{total} registro{total !== 1 ? 's' : ''}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* Desktop */}
              <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Bairro</TableHead>
                      <TableHead>Prioridade</TableHead>
                      <TableHead title="Prazo total definido para resolução">Prazo</TableHead>
                      <TableHead>Restante</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="min-w-[200px]">Agente</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map(sla => {
                      const visual = getSlaVisualStatus(sla);
                      const cfg = statusBadge[sla.status] || statusBadge.pendente;
                      const isUpdating = updatingId === sla.id;
                      return (
                        <TableRow key={sla.id} className={cn(visual === 'expired' && 'bg-destructive/10 border-l-4 border-l-destructive')}>
                          <TableCell className="text-center text-lg">{visualEmoji[visual]}</TableCell>
                          <TableCell className="font-medium text-sm">
                            <span className="flex items-center gap-1 flex-wrap">
                              {sla.escalonado && <span title={`Escalonado de ${sla.prioridade_original}`} className="text-destructive">🔺</span>}
                              {getSlaLocalLabel(sla)}
                              <Badge variant="outline" className="text-[9px] px-1 py-0 font-normal">
                                {getSlaOrigem(sla) === 'pluvio' ? '🌧 Pluvio' : '📋 Lev.'}
                              </Badge>
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] font-bold">{sla.prioridade}</Badge>
                            {sla.escalonado && sla.prioridade_original && (
                              <span className="text-[9px] text-muted-foreground ml-1 line-through">{sla.prioridade_original}</span>
                            )}
                          </TableCell>
                          <TableCell className="tabular-nums text-xs">{formatSlaHoras(sla.sla_horas)}</TableCell>
                          <TableCell className={cn('text-xs font-semibold',
                            visual === 'expired' ? 'text-destructive' : visual === 'warning' ? 'text-warning' : 'text-success'
                          )}>
                            {sla.status === 'concluido' ? '—' : getTempoRestante(sla.prazo_final)}
                          </TableCell>
                          <TableCell>
                            <Badge className={cn('text-[10px] font-bold border-0', cfg.color)}>{cfg.label}</Badge>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={sla.agente_id || 'none'}
                              onValueChange={(v) => handleAssign(sla.id, v === 'none' ? '' : v)}
                              disabled={isUpdating || sla.status === 'concluido'}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Atribuir..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none" className="text-xs text-muted-foreground">Nenhum</SelectItem>
                                {operadores.map(op => (
                                  <SelectItem key={op.id} value={op.id} className="text-xs">{op.nome}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {sla.status === 'concluido' && (
                                <Button size="sm" variant="outline" className="h-7 text-[10px]" disabled={isUpdating}
                                  onClick={() => handleReabrir(sla.id)}>
                                  Reabrir
                                </Button>
                              )}
                              {sla.status === 'vencido' && (
                                <>
                                  <Button size="sm" variant="outline" className="h-7 text-[10px]" disabled={isUpdating}
                                    onClick={() => handleReabrir(sla.id)}>
                                    Reabrir
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-7 text-[10px] text-destructive border-destructive/30 hover:bg-destructive/10" disabled={isUpdating}
                                    onClick={() => handleEscalar(sla.id)}>
                                    <TrendingUp className="w-3 h-3 mr-1" />
                                    Escalar
                                  </Button>
                                </>
                              )}
                              {(sla.status === 'pendente' || sla.status === 'em_atendimento') && (
                                <>
                                  {sla.status === 'pendente' && sla.agente_id && (
                                    <Button size="sm" variant="outline" className="h-7 text-[10px]" disabled={isUpdating}
                                      onClick={() => handleForceStatus(sla.id, 'em_atendimento')}>
                                      Iniciar
                                    </Button>
                                  )}
                                  {sla.status === 'em_atendimento' && (
                                    <Button size="sm" className="h-7 text-[10px] bg-success hover:bg-success/90 text-success-foreground" disabled={isUpdating}
                                      onClick={() => handleForceStatus(sla.id, 'concluido')}>
                                      Concluir
                                    </Button>
                                  )}
                                  <Button size="sm" variant="outline" className="h-7 text-[10px] text-warning border-warning/30 hover:bg-warning/10" disabled={isUpdating}
                                    onClick={() => handleEscalar(sla.id)}>
                                    <TrendingUp className="w-3 h-3 mr-1" />
                                    Escalar
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {paginated.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-sm">
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
                  const cfg = statusBadge[sla.status] || statusBadge.pendente;
                  const isUpdating = updatingId === sla.id;
                  return (
                    <div key={sla.id} className={cn('p-4 space-y-3', visual === 'expired' && 'bg-destructive/10 border-l-4 border-l-destructive')}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{visualEmoji[visual]}</span>
                          <span className="font-semibold text-sm flex items-center gap-1 flex-wrap">
                            {sla.escalonado && <span className="text-destructive">🔺</span>}
                            {getSlaLocalLabel(sla)}
                            <Badge variant="outline" className="text-[9px] px-1 py-0 font-normal">
                              {getSlaOrigem(sla) === 'pluvio' ? '🌧' : '📋'}
                            </Badge>
                          </span>
                        </div>
                        <Badge className={cn('text-[10px] font-bold border-0', cfg.color)}>{cfg.label}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{sla.prioridade} · SLA {sla.sla_horas}h</span>
                        <span className={cn('font-bold',
                          visual === 'expired' ? 'text-destructive' : visual === 'warning' ? 'text-warning' : 'text-success'
                        )}>
                          {sla.status === 'concluido' ? 'Concluído' : getTempoRestante(sla.prazo_final)}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <Select
                          value={sla.agente_id || 'none'}
                          onValueChange={(v) => handleAssign(sla.id, v === 'none' ? '' : v)}
                          disabled={isUpdating || sla.status === 'concluido'}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Atribuir operador..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none" className="text-xs text-muted-foreground">Nenhum</SelectItem>
                            {operadores.map(op => (
                              <SelectItem key={op.id} value={op.id} className="text-xs">{op.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {sla.status === 'concluido' && (
                          <Button size="sm" variant="outline" className="h-7 text-[10px] w-full" disabled={isUpdating}
                            onClick={() => handleReabrir(sla.id)}>Reabrir</Button>
                        )}
                        {sla.status === 'vencido' && (
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="h-7 text-[10px] flex-1" disabled={isUpdating}
                              onClick={() => handleReabrir(sla.id)}>Reabrir</Button>
                            <Button size="sm" variant="outline" className="h-7 text-[10px] flex-1 text-destructive border-destructive/30" disabled={isUpdating}
                              onClick={() => handleEscalar(sla.id)}>
                              <TrendingUp className="w-3 h-3 mr-1" />Escalar
                            </Button>
                          </div>
                        )}
                        {(sla.status === 'pendente' || sla.status === 'em_atendimento') && (
                          <div className="flex gap-2">
                            {sla.status === 'pendente' && sla.agente_id && (
                              <Button size="sm" variant="outline" className="h-7 text-[10px] flex-1" disabled={isUpdating}
                                onClick={() => handleForceStatus(sla.id, 'em_atendimento')}>Iniciar</Button>
                            )}
                            {sla.status === 'em_atendimento' && (
                              <Button size="sm" className="h-7 text-[10px] flex-1 bg-success hover:bg-success/90 text-success-foreground" disabled={isUpdating}
                                onClick={() => handleForceStatus(sla.id, 'concluido')}>Concluir</Button>
                            )}
                            <Button size="sm" variant="outline" className="h-7 text-[10px] text-warning border-warning/30" disabled={isUpdating}
                              onClick={() => handleEscalar(sla.id)}>
                              <TrendingUp className="w-3 h-3 mr-1" />Escalar
                            </Button>
                          </div>
                        )}
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
            <TablePagination
              page={page} totalPages={totalPages} total={total}
              pageSize={pageSize} onGoTo={goTo} onNext={next} onPrev={prev}
              onPageSizeChange={setPageSize}
            />
          )}
        </TabsContent>

        {/* ── Tab: Configuração ── */}
        <TabsContent value="config">
          <SlaConfigTab clienteId={clienteId} />
        </TabsContent>

        {/* ── Tab: Por Região ── */}
        <TabsContent value="regioes">
          <SlaRegioesTab clienteId={clienteId} />
        </TabsContent>

        {/* ── Tab: Histórico ── */}
        <TabsContent value="audit">
          <SlaAuditLog clienteId={clienteId} clienteNome={clienteAtivo?.nome} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

function SummaryCard({ label, value, icon: Icon, color, tooltip }: {
  label: string; value: number; icon: typeof Clock; color: string; tooltip?: string;
}) {
  const card = (
    <Card className="stat-card relative">
      {tooltip && <Info className="absolute top-2 right-2 w-3 h-3 text-muted-foreground/40" />}
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', color.replace('text-', 'bg-') + '/10')}>
          <Icon className={cn('w-4 h-4', color)} />
        </div>
        <div>
          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="text-xl font-black tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
  if (!tooltip) return card;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{card}</TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[220px] text-xs leading-relaxed">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export default AdminSla;
