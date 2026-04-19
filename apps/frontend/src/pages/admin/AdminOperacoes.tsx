import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/services/api';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { useOperacoesComVinculos } from '@/hooks/queries/useOperacoesComVinculos';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination } from '@/hooks/usePagination';
import TablePagination from '@/components/TablePagination';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Search, Loader2, Plus, Pencil, Trash2, PlayCircle, CheckCircle2, AlertTriangle, Clock, RefreshCw, Zap, MapPin, ClipboardList, FileSpreadsheet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import AdminPageHeader from '@/components/AdminPageHeader';
import MobileListCard from '@/components/admin/MobileListCard';

/* ── Types ── */
type TipoVinculo = 'operacional' | 'levantamento' | 'regiao' | null;

interface Operacao {
  id: string;
  cliente_id: string;
  item_id: string | null;
  tipo_vinculo: TipoVinculo;
  item_operacional_id: string | null;
  item_levantamento_id: string | null;
  regiao_id: string | null;
  status: string;
  prioridade: string | null;
  responsavel_id: string | null;
  created_at: string;
  iniciado_em: string | null;
  concluido_em: string | null;
  observacao: string | null;
  // joined
  vinculo_nome?: string;
}

interface Agente { id: string; nome: string; }
interface RunOption { id: string; dt_ref: string; }

/* ── Visual config ── */
const STATUS_OPTIONS = ['pendente', 'em_andamento', 'concluido', 'cancelado'] as const;
const PRIORIDADE_OPTIONS = ['Urgente', 'Alta', 'Média', 'Baixa'] as const;

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pendente:      { label: 'Pendente',      color: 'bg-muted text-muted-foreground',       icon: Clock },
  em_andamento:  { label: 'Em Andamento',  color: 'bg-info/15 text-info',                 icon: PlayCircle },
  concluido:     { label: 'Concluído',     color: 'bg-success/15 text-success',            icon: CheckCircle2 },
  cancelado:     { label: 'Cancelado',     color: 'bg-destructive/15 text-destructive',    icon: AlertTriangle },
};

const prioridadeColor: Record<string, string> = {
  Urgente: 'bg-red-500/15 text-red-600 dark:text-red-400',
  Alta:    'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  Média:   'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
  Baixa:   'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
};

const vinculoIcon: Record<string, typeof MapPin> = {
  operacional: FileSpreadsheet,
  levantamento: ClipboardList,
  regiao: MapPin,
};

const emptyForm = {
  status: 'pendente',
  prioridade: '',
  responsavel_id: '',
  observacao: '',
};

const AdminOperacoes = () => {
  const { isAdmin } = useAuth();
  const { clienteId } = useClienteAtivo();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPrioridade, setFilterPrioridade] = useState('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Auto-generation
  const [selectedRunId, setSelectedRunId] = useState('');
  const [generating, setGenerating] = useState(false);

  /* ── Queries ── */
  const { data: operacoesData = [], isLoading: loading } = useOperacoesComVinculos(clienteId);

  const data = operacoesData as Operacao[];

  const { data: agentes = [] } = useQuery({
    queryKey: ['admin_operacoes_agentes', clienteId],
    queryFn: () => api.usuarios.listAgentes(clienteId!) as Promise<Agente[]>,
    enabled: !!clienteId,
    staleTime: 0,
  });

  const { data: runs = [] } = useQuery({
    queryKey: ['admin_operacoes_runs', clienteId],
    queryFn: async () => {
      const list = await api.sla.listRunsByCliente(clienteId!) as RunOption[];
      setSelectedRunId(prev => prev || (list[0]?.id || ''));
      return list;
    },
    enabled: !!clienteId,
    staleTime: 0,
  });

  /* ── Mutations ── */
  const saveMutation = useMutation({
    mutationFn: async ({ formData, editId }: { formData: typeof emptyForm; editId: string | null }) => {
      if (!clienteId) return;
      const prevOp = editId ? data.find(d => d.id === editId) : undefined;
      await api.operacoes.salvar({
        clienteId,
        id: editId ?? undefined,
        status: formData.status,
        prioridade: formData.prioridade || null,
        responsavel_id: formData.responsavel_id || null,
        observacao: formData.observacao || null,
        prevStatus: prevOp?.status,
      });
    },
    onSuccess: (_, { editId }) => {
      queryClient.invalidateQueries({ queryKey: ['operacoes_com_vinculos', clienteId] });
      setDialogOpen(false);
      toast.success(editId ? 'Operação atualizada' : 'Operação criada');
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Erro ao salvar'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.operacoes.remover(id);
    },
    onSuccess: () => {
      setDeletingId(null);
      queryClient.invalidateQueries({ queryKey: ['operacoes_com_vinculos', clienteId] });
      toast.success('Operação removida');
    },
    onError: (err: unknown) => { setDeletingId(null); toast.error(err instanceof Error ? err.message : 'Erro ao excluir'); },
  });

  const quickStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      await api.operacoes.atualizarStatus(id, newStatus);
      return newStatus;
    },
    onSuccess: (newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['operacoes_com_vinculos', clienteId] });
      toast.success(`Status → ${statusConfig[newStatus]?.label || newStatus}`);
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Erro'),
  });

  /* ── Auto-generate from run ── */
  const handleGenerateFromRun = async () => {
    if (!selectedRunId || !clienteId) return;
    setGenerating(true);
    try {
      const items = await api.pluvioOperacional.listItems(selectedRunId) as {
        id: string; bairro_nome: string; prioridade_operacional: string; classificacao_risco: string;
      }[];

      if (!items || items.length === 0) { toast.error('Nenhum item encontrado neste run'); return; }

      const itemIds = items.map(i => i.id);
      const existingIds = new Set(await api.operacoes.listExistingItemIds(clienteId, itemIds));
      const newItems = items.filter(i => !existingIds.has(i.id));

      if (newItems.length === 0) { toast.info('Todos os itens deste run já possuem operação aberta.'); return; }

      const rows = newItems.map(i => ({
        cliente_id: clienteId,
        item_operacional_id: i.id,
        tipo_vinculo: 'operacional' as const,
        status: 'pendente',
        prioridade: i.prioridade_operacional || 'Baixa',
        observacao: `Auto: ${i.bairro_nome} — ${i.classificacao_risco}`,
      }));

      await api.operacoes.bulkInsert(rows);

      toast.success(`${newItems.length} operação(ões) criada(s) a partir do run`);
      queryClient.invalidateQueries({ queryKey: ['operacoes_com_vinculos', clienteId] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar operações');
    } finally {
      setGenerating(false);
    }
  };

  /* ── Filtered ── */
  const filtered = data.filter(op => {
    if (filterStatus !== 'all' && op.status !== filterStatus) return false;
    if (filterPrioridade !== 'all' && op.prioridade !== filterPrioridade) return false;
    if (debouncedSearch) {
      const s = debouncedSearch.toLowerCase();
      const resp = agentes.find(o => o.id === op.responsavel_id)?.nome || '';
      if (
        !resp.toLowerCase().includes(s) &&
        !(op.observacao || '').toLowerCase().includes(s) &&
        !(op.vinculo_nome || '').toLowerCase().includes(s)
      ) return false;
    }
    return true;
  });

  const { page, totalPages, paginated, goTo, next, prev, total: filteredTotal, pageSize, setPageSize } = usePagination(filtered, 25);

  /* ── CRUD ── */
  const openNew = () => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); };

  const openEdit = (op: Operacao) => {
    setEditingId(op.id);
    setForm({
      status: op.status,
      prioridade: op.prioridade || '',
      responsavel_id: op.responsavel_id || '',
      observacao: op.observacao || '',
    });
    setDialogOpen(true);
  };

  const handleSave = () => saveMutation.mutate({ formData: form, editId: editingId });

  const handleDelete = (id: string) => {
    setDeletingId(id);
    deleteMutation.mutate(id);
  };

  const quickStatus = (id: string, newStatus: string) => quickStatusMutation.mutate({ id, newStatus });

  /* ── Stats ── */
  const total = data.length;
  const pendentes = data.filter(d => d.status === 'pendente').length;
  const andamento = data.filter(d => d.status === 'em_andamento').length;
  const concluidas = data.filter(d => d.status === 'concluido').length;

  const stats = [
    { label: 'Total', value: total, icon: RefreshCw, color: 'text-foreground' },
    { label: 'Pendentes', value: pendentes, icon: Clock, color: 'text-yellow-500' },
    { label: 'Em Andamento', value: andamento, icon: PlayCircle, color: 'text-info' },
    { label: 'Concluídas', value: concluidas, icon: CheckCircle2, color: 'text-success' },
  ];

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  const VinculoBadge = ({ op }: { op: Operacao }) => {
    if (!op.vinculo_nome) return <span className="text-muted-foreground">—</span>;
    const tipo = op.tipo_vinculo || (op.item_operacional_id ? 'operacional' : op.item_levantamento_id ? 'levantamento' : 'regiao');
    const Icon = vinculoIcon[tipo] || MapPin;
    const labels: Record<string, string> = { operacional: 'Bairro', levantamento: 'Item', regiao: 'Região' };
    return (
      <div className="flex items-center gap-1.5 min-w-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{labels[tipo] || 'Vínculo'}</p>
          <p className="text-xs font-medium truncate">{op.vinculo_nome}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <AdminPageHeader
        title="Operações"
        description="Gerencie operações com rastreabilidade a bairros, itens e regiões"
        icon={RefreshCw}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(s => (
          <Card key={s.label} className="rounded-sm border-border/60 bg-card shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={cn('p-2 rounded-xl bg-muted/50', s.color)}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-black">{s.value}</p>
                <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Auto-generate card */}
      {isAdmin && runs.length > 0 && (
        <Card className="rounded-sm border-border/60 bg-card shadow-sm">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Gerar operações a partir de run pluviométrico
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="flex flex-col sm:flex-row items-end gap-3">
              <div className="flex-1 w-full space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Run (data de referência)</Label>
                <Select value={selectedRunId} onValueChange={setSelectedRunId}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Selecione um run" />
                  </SelectTrigger>
                  <SelectContent>
                    {runs.map(r => (
                      <SelectItem key={r.id} value={r.id}>
                        {new Date(r.dt_ref + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleGenerateFromRun} disabled={generating || !selectedRunId} className="h-10 gap-2 shrink-0">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                Gerar Operações
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Cria uma operação para cada bairro do run que ainda não possui operação aberta. Prioridade e observação herdadas do item.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="rounded-sm border-border/60 bg-card shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por vínculo, responsável ou observação..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-[160px] h-10">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                {STATUS_OPTIONS.map(s => (
                  <SelectItem key={s} value={s}>{statusConfig[s]?.label || s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterPrioridade} onValueChange={setFilterPrioridade}>
              <SelectTrigger className="w-full sm:w-[160px] h-10">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {PRIORIDADE_OPTIONS.map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isAdmin && (
              <Button onClick={openNew} className="h-10 gap-2">
                <Plus className="h-4 w-4" /> Nova
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="rounded-sm border-border/60 bg-card shadow-sm overflow-hidden">
        {loading ? (
          <CardContent className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        ) : filtered.length === 0 ? (
          <CardContent className="text-center py-16 text-muted-foreground">
            Nenhuma operação encontrada.
          </CardContent>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Vínculo</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Status</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Prioridade</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Responsável</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Criada</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider">Observação</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map(op => {
                    const sc = statusConfig[op.status] || statusConfig.pendente;
                    const pc = prioridadeColor[op.prioridade || ''] || 'bg-muted/50 text-muted-foreground';
                    const resp = agentes.find(o => o.id === op.responsavel_id)?.nome || '—';
                    return (
                      <TableRow key={op.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell><VinculoBadge op={op} /></TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('border-transparent text-[10px] uppercase font-black tracking-widest px-2 py-0.5', sc.color)}>
                            {sc.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {op.prioridade ? (
                            <Badge variant="outline" className={cn('border-transparent text-[10px] uppercase font-black tracking-widest px-2 py-0.5', pc)}>
                              {op.prioridade}
                            </Badge>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-sm font-medium">{resp}</TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">{fmtDate(op.created_at)}</TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">{op.observacao || '—'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {op.status === 'pendente' && (
                              <Button size="icon" variant="ghost" className="h-8 w-8" title="Iniciar" onClick={() => quickStatus(op.id, 'em_andamento')}>
                                <PlayCircle className="h-4 w-4 text-info" />
                              </Button>
                            )}
                            {op.status === 'em_andamento' && (
                              <Button size="icon" variant="ghost" className="h-8 w-8" title="Concluir" onClick={() => quickStatus(op.id, 'concluido')}>
                                <CheckCircle2 className="h-4 w-4 text-success" />
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(op)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {isAdmin && (
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(op.id)} disabled={deletingId === op.id}>
                                {deletingId === op.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile */}
            <div className="md:hidden divide-y divide-border/40">
              {paginated.map(op => {
                const sc = statusConfig[op.status] || statusConfig.pendente;
                const resp = agentes.find(o => o.id === op.responsavel_id)?.nome || '—';
                return (
                  <MobileListCard
                    key={op.id}
                    title={op.vinculo_nome || op.prioridade || 'Sem vínculo'}
                    fields={[
                      { label: 'Responsável', value: resp },
                      { label: 'Status', value: sc.label },
                      { label: 'Prioridade', value: op.prioridade || '—' },
                      { label: 'Criada', value: fmtDate(op.created_at) },
                    ]}
                    badges={
                      <Badge variant="outline" className={cn('border-transparent text-[9px] uppercase font-black', sc.color)}>
                        {sc.label}
                      </Badge>
                    }
                    onEdit={() => openEdit(op)}
                    extra={
                      <div className="flex gap-1 pt-1">
                        {op.status === 'pendente' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => quickStatus(op.id, 'em_andamento')}>
                            <PlayCircle className="h-3 w-3" /> Iniciar
                          </Button>
                        )}
                        {op.status === 'em_andamento' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => quickStatus(op.id, 'concluido')}>
                            <CheckCircle2 className="h-3 w-3" /> Concluir
                          </Button>
                        )}
                      </div>
                    }
                  />
                );
              })}
            </div>

            <div className="p-4 border-t border-border/40">
              <TablePagination page={page} totalPages={totalPages} total={filteredTotal} pageSize={pageSize} onGoTo={goTo} onNext={next} onPrev={prev} onPageSizeChange={setPageSize} />
            </div>
          </>
        )}
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Operação' : 'Nova Operação'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s} value={s}>{statusConfig[s]?.label || s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Prioridade</Label>
              <Select value={form.prioridade} onValueChange={v => setForm(f => ({ ...f, prioridade: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {PRIORIDADE_OPTIONS.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Responsável</Label>
              <Select value={form.responsavel_id} onValueChange={v => setForm(f => ({ ...f, responsavel_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {agentes.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Observação</Label>
              <Textarea
                value={form.observacao}
                onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
                placeholder="Detalhes da operação..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2">
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminOperacoes;
