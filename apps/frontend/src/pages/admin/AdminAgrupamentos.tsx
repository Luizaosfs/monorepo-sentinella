/**
 * AdminAgrupamentos — Gerenciamento de agrupamentos regionais (P5)
 *
 * Permite ao admin criar agrupamentos regionais e vincular municípios.
 * Acesso restrito: apenas admin da plataforma.
 */
import { useState } from 'react';
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
  ChevronRight, X,
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
  consorcio: 'bg-blue-50 text-blue-700 border-blue-200',
  regiao_saude: 'bg-green-50 text-green-700 border-green-200',
  estado: 'bg-purple-50 text-purple-700 border-purple-200',
};

const emptyForm = { nome: '', tipo: 'consorcio' as AgrupamentoRegional['tipo'], uf: '' };

export default function AdminAgrupamentos() {
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selectedAgrupamento, setSelectedAgrupamento] = useState<AgrupamentoRegional | null>(null);
  const [novoClienteId, setNovoClienteId] = useState('');

  // ── Queries ────────────────────────────────────────────────────────────────

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

  // ── Mutations ──────────────────────────────────────────────────────────────

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

  // ── Derived ────────────────────────────────────────────────────────────────

  const vinculadosIds = new Set(clientesDoAgrupamento.map((ac: { cliente_id: string }) => ac.cliente_id));
  const clientesDisponiveis = todosClientes.filter((c: { id: string }) => !vinculadosIds.has(c.id));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
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

      {/* Layout master-detail */}
      <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] gap-4 items-start">

        {/* ── Coluna esquerda: lista de agrupamentos ── */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-3">
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
            agrupamentos.map((ag: AgrupamentoRegional) => {
              const isSelected = selectedAgrupamento?.id === ag.id;
              return (
                <button
                  key={ag.id}
                  onClick={() => setSelectedAgrupamento(isSelected ? null : ag)}
                  className={[
                    'w-full text-left rounded-xl border p-3.5 transition-all',
                    'hover:border-primary/40 hover:shadow-sm',
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border bg-card',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={[
                        'mt-0.5 p-1.5 rounded-lg shrink-0',
                        isSelected ? 'bg-primary/10' : 'bg-muted',
                      ].join(' ')}>
                        <Building2 className={[
                          'w-4 h-4',
                          isSelected ? 'text-primary' : 'text-muted-foreground',
                        ].join(' ')} />
                      </div>
                      <div className="min-w-0">
                        <p className={[
                          'text-sm font-semibold truncate',
                          isSelected ? 'text-primary' : '',
                        ].join(' ')}>
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
                            <span className="text-[11px] text-muted-foreground font-mono">
                              {ag.uf}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className={[
                      'w-4 h-4 shrink-0 mt-1 transition-transform',
                      isSelected ? 'text-primary rotate-90' : 'text-muted-foreground/40',
                    ].join(' ')} />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* ── Coluna direita: detalhe do agrupamento selecionado ── */}
        {selectedAgrupamento ? (
          <Card className="border-border">
            <CardContent className="p-0">

              {/* Header do detalhe */}
              <div className="flex items-start justify-between gap-4 p-5 border-b">
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
                      <Badge variant="outline" className="text-xs font-mono">
                        {selectedAgrupamento.uf}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Gerencie os municípios que fazem parte deste agrupamento.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground"
                  onClick={() => setSelectedAgrupamento(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Adicionar município */}
              <div className="p-5 border-b bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
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
                        {clientesDisponiveis.map((c: { id: string; nome: string }) => (
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

              {/* Lista de municípios vinculados */}
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Municípios vinculados
                  </p>
                  {!loadingClientes && (
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {clientesDoAgrupamento.length}
                    </span>
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
                  <div className="space-y-1">
                    {clientesDoAgrupamento.map((ac: { cliente_id: string; clientes?: { nome: string } }) => (
                      <div
                        key={ac.cliente_id}
                        className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/60 transition-colors group"
                      >
                        <div className="flex items-center gap-2.5">
                          <MapPin className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                          <span className="text-sm font-medium">
                            {(ac.clientes as { nome: string } | undefined)?.nome ?? ac.cliente_id}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                          onClick={() => removeClienteMutation.mutate({
                            agrupamentoId: selectedAgrupamento.id,
                            clienteId: ac.cliente_id,
                          })}
                          disabled={removeClienteMutation.isPending}
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          Remover
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </CardContent>
          </Card>
        ) : (
          /* Placeholder quando nada está selecionado */
          <div className="hidden md:flex flex-col items-center justify-center h-64 text-center text-muted-foreground border-2 border-dashed rounded-xl">
            <Users className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm font-medium">Selecione um agrupamento</p>
            <p className="text-xs mt-1 opacity-70">para gerenciar seus municípios</p>
          </div>
        )}
      </div>

      {/* ── Dialog: criar agrupamento ── */}
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
              <Label htmlFor="nome">
                Nome <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nome"
                placeholder="Ex: Consórcio Vale do Paraíba"
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label>
                Tipo <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.tipo}
                onValueChange={v => setForm(f => ({ ...f, tipo: v as AgrupamentoRegional['tipo'] }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Define a natureza administrativa do agrupamento.
              </p>
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
            <Button
              disabled={!form.nome.trim() || criarMutation.isPending}
              onClick={() => criarMutation.mutate()}
            >
              {criarMutation.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Criar agrupamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
