import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Loader2, Plus, Trash2, Building2, MapPin, Users,
  ChevronRight, X, Search,
} from 'lucide-react';
import AdminPageHeader from '@/components/AdminPageHeader';
import { STALE } from '@/lib/queryConfig';
import type { AgrupamentoRegional } from '@/types/database';

const TIPO_LABELS: Record<string, string> = {
  consorcio: 'Consórcio Intermunicipal',
  regiao_saude: 'Região de Saúde',
  estado: 'Estado',
};

const TIPO_COLORS: Record<string, string> = {
  consorcio: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  regiao_saude: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800',
  estado: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
};

const emptyForm = { nome: '', tipo: 'consorcio' as AgrupamentoRegional['tipo'], uf: '' };

export default function AdminAgrupamentos() {
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selectedAgrupamento, setSelectedAgrupamento] = useState<AgrupamentoRegional | null>(null);
  const [novoClienteId, setNovoClienteId] = useState('');
  const [searchVinculados, setSearchVinculados] = useState('');

  const { data: agrupamentos = [], isLoading } = useQuery({
    queryKey: ['agrupamentos'],
    queryFn: () => api.agrupamentos.list(),
    staleTime: STALE.MEDIUM,
  });

  const { data: todosClientes = [] } = useQuery({
    queryKey: ['clientes-all'],
    queryFn: () => api.clientes.listAll(),
    staleTime: STALE.LONG,
  });

  const { data: clientesDoAgrupamento = [], isLoading: loadingClientes } = useQuery({
    queryKey: ['agrupamento-clientes', selectedAgrupamento?.id],
    queryFn: () => api.agrupamentos.listClientes(selectedAgrupamento!.id),
    enabled: !!selectedAgrupamento,
    staleTime: STALE.SHORT,
  });

  const criarMutation = useMutation({
    mutationFn: () => api.agrupamentos.create({
      nome: form.nome.trim(),
      tipo: form.tipo,
      uf: form.uf.trim().toUpperCase() || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agrupamentos'] });
      setForm(emptyForm);
      setShowCreateDialog(false);
      toast.success('Agrupamento criado com sucesso.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addClienteMutation = useMutation({
    mutationFn: ({ agrupamentoId, clienteId }: { agrupamentoId: string; clienteId: string }) =>
      api.agrupamentos.addCliente(agrupamentoId, clienteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agrupamento-clientes', selectedAgrupamento?.id] });
      setNovoClienteId('');
      toast.success('Município vinculado.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeClienteMutation = useMutation({
    mutationFn: ({ agrupamentoId, clienteId }: { agrupamentoId: string; clienteId: string }) =>
      api.agrupamentos.removeCliente(agrupamentoId, clienteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agrupamento-clientes', selectedAgrupamento?.id] });
      toast.success('Município removido.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  type ClienteVinculado = { id: string; nome: string; cidade?: string; uf?: string };

  const vinculadosIds = useMemo(
    () => new Set((clientesDoAgrupamento as ClienteVinculado[]).map((c) => c.id)),
    [clientesDoAgrupamento],
  );

  const clientesDisponiveis = useMemo(
    () => (todosClientes as { id: string; nome: string }[]).filter((c) => !vinculadosIds.has(c.id)),
    [todosClientes, vinculadosIds],
  );

  const vinculadosFiltrados = useMemo(() => {
    const q = searchVinculados.toLowerCase();
    return (clientesDoAgrupamento as ClienteVinculado[]).filter((c) =>
      (c.nome ?? c.id ?? '').toLowerCase().includes(q),
    );
  }, [clientesDoAgrupamento, searchVinculados]);

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Agrupamentos Regionais"
        description="Consórcios, regiões de saúde e estados para acesso analítico do analista regional."
        action={
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Novo agrupamento
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 items-start">

        {/* ── Coluna esquerda: lista ── */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
            Agrupamentos ({agrupamentos.length})
          </p>

          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : agrupamentos.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
              <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">Nenhum agrupamento</p>
              <p className="text-xs mt-1 opacity-70">Crie um para começar</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {(agrupamentos as AgrupamentoRegional[]).map((ag) => {
                const isSelected = selectedAgrupamento?.id === ag.id;
                return (
                  <button
                    key={ag.id}
                    onClick={() => {
                      setSelectedAgrupamento(isSelected ? null : ag);
                      setSearchVinculados('');
                      setNovoClienteId('');
                    }}
                    className={[
                      'w-full text-left rounded-xl border px-4 py-3 transition-all',
                      'hover:border-primary/40 hover:shadow-sm',
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border bg-card',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className={['text-sm font-semibold truncate', isSelected ? 'text-primary' : ''].join(' ')}>
                          {ag.nome}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className={[
                            'text-[11px] px-1.5 py-0.5 rounded border font-medium',
                            TIPO_COLORS[ag.tipo] ?? 'bg-muted text-muted-foreground border-border',
                          ].join(' ')}>
                            {TIPO_LABELS[ag.tipo] ?? ag.tipo}
                          </span>
                          {ag.uf && (
                            <span className="text-[11px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                              {ag.uf}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className={[
                        'w-4 h-4 shrink-0 transition-transform text-muted-foreground/50',
                        isSelected ? 'rotate-90 text-primary' : '',
                      ].join(' ')} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Coluna direita: detalhe ── */}
        {selectedAgrupamento ? (
          <Card className="border-border">
            <CardContent className="p-0">

              {/* Header */}
              <div className="flex items-start justify-between gap-4 p-4 border-b">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-semibold">{selectedAgrupamento.nome}</h2>
                    <span className={[
                      'text-[11px] px-1.5 py-0.5 rounded border font-medium',
                      TIPO_COLORS[selectedAgrupamento.tipo] ?? 'bg-muted text-muted-foreground border-border',
                    ].join(' ')}>
                      {TIPO_LABELS[selectedAgrupamento.tipo] ?? selectedAgrupamento.tipo}
                    </span>
                    {selectedAgrupamento.uf && (
                      <Badge variant="outline" className="text-xs font-mono">{selectedAgrupamento.uf}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Gerencie os municípios que fazem parte deste agrupamento.
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setSelectedAgrupamento(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Vincular município */}
              <div className="p-4 border-b bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Vincular município
                </p>
                {clientesDisponiveis.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">
                    Todos os municípios já estão vinculados a este agrupamento.
                  </p>
                ) : (
                  <div className="flex gap-2">
                    <Select value={novoClienteId} onValueChange={setNovoClienteId}>
                      <SelectTrigger className="flex-1 bg-background">
                        <SelectValue placeholder="Selecione um município..." />
                      </SelectTrigger>
                      <SelectContent>
                        {clientesDisponiveis.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      disabled={!novoClienteId || addClienteMutation.isPending}
                      onClick={() => addClienteMutation.mutate({
                        agrupamentoId: selectedAgrupamento.id,
                        clienteId: novoClienteId,
                      })}
                    >
                      {addClienteMutation.isPending
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <><Plus className="w-4 h-4 mr-1.5" />Vincular</>}
                    </Button>
                  </div>
                )}
              </div>

              {/* Municípios vinculados */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Municípios vinculados
                  </p>
                  {!loadingClientes && (
                    <Badge variant="secondary" className="text-xs">
                      {clientesDoAgrupamento.length}
                    </Badge>
                  )}
                </div>

                {loadingClientes ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : clientesDoAgrupamento.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-xl">
                    <MapPin className="w-7 h-7 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">Nenhum município vinculado</p>
                    <p className="text-xs mt-1 opacity-70">Use o campo acima para adicionar</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Busca inline quando há vários */}
                    {clientesDoAgrupamento.length > 4 && (
                      <div className="relative mb-2">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                          className="pl-8 h-8 text-sm"
                          placeholder="Filtrar municípios..."
                          value={searchVinculados}
                          onChange={(e) => setSearchVinculados(e.target.value)}
                        />
                      </div>
                    )}

                    {vinculadosFiltrados.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic text-center py-4">Nenhum resultado</p>
                    ) : (
                      vinculadosFiltrados.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-card hover:bg-muted/40 transition-colors group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <MapPin className="w-3.5 h-3.5 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{c.nome}</p>
                              {(c.cidade || c.uf) && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {[c.cidade, c.uf].filter(Boolean).join(' · ')}
                                </p>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all shrink-0"
                            onClick={() => removeClienteMutation.mutate({
                              agrupamentoId: selectedAgrupamento.id,
                              clienteId: c.id,
                            })}
                            disabled={removeClienteMutation.isPending}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                            Remover
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

            </CardContent>
          </Card>
        ) : (
          <div className="hidden md:flex flex-col items-center justify-center h-64 text-center text-muted-foreground border-2 border-dashed rounded-xl">
            <Users className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm font-medium">Selecione um agrupamento</p>
            <p className="text-xs mt-1 opacity-70">para gerenciar seus municípios</p>
          </div>
        )}
      </div>

      {/* Dialog criar agrupamento */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Novo agrupamento regional
            </DialogTitle>
          </DialogHeader>

          <Separator />

          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome <span className="text-destructive">*</span></Label>
              <Input
                id="nome"
                placeholder="Ex: Consórcio Vale do Paraíba"
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label>Tipo <span className="text-destructive">*</span></Label>
              <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v as AgrupamentoRegional['tipo'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="uf">UF <span className="text-muted-foreground text-xs font-normal">(opcional)</span></Label>
              <Input
                id="uf"
                maxLength={2}
                placeholder="SP"
                className="w-20 font-mono uppercase"
                value={form.uf}
                onChange={e => setForm(f => ({ ...f, uf: e.target.value }))}
              />
            </div>
          </div>

          <Separator />

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => { setShowCreateDialog(false); setForm(emptyForm); }}>
              Cancelar
            </Button>
            <Button disabled={!form.nome.trim() || criarMutation.isPending} onClick={() => criarMutation.mutate()}>
              {criarMutation.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Criar agrupamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
