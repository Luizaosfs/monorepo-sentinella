import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import { SlaFeriado } from '@/types/database';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, ArrowLeft, CalendarPlus } from 'lucide-react';
import AdminPageHeader from '@/components/AdminPageHeader';
import MobileListCard from '@/components/admin/MobileListCard';
import ConfirmDialog from '@/components/admin/ConfirmDialog';

const emptyForm = {
  data: '',
  descricao: '',
  recorrente: false,
};

function formatDate(iso: string): string {
  if (!iso) return '—';
  const [year, month, day] = iso.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

export default function AdminSlaFeriados() {
  const { clienteId } = useClienteAtivo();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);
  const [seedLoading, setSeedLoading] = useState(false);

  const { data: feriados = [], isLoading: loading } = useQuery({
    queryKey: ['admin_sla_feriados', clienteId],
    queryFn: () => {
      if (!clienteId) return Promise.resolve([] as SlaFeriado[]);
      return api.slaFeriados.listByCliente(clienteId);
    },
    enabled: !!clienteId,
    staleTime: STALE.STATIC,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!clienteId) throw new Error('Cliente não selecionado');
      await api.slaFeriados.create({
        cliente_id: clienteId,
        data: form.data,
        descricao: form.descricao.trim(),
        nacional: form.recorrente,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_sla_feriados', clienteId] });
      setShowForm(false);
      setForm(emptyForm);
      toast.success('Feriado cadastrado');
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Erro ao salvar'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.slaFeriados.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_sla_feriados', clienteId] });
      toast.success('Feriado removido');
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Erro ao remover'),
  });

  const handleSeedNacionais = async () => {
    if (!clienteId) return;
    setSeedLoading(true);
    try {
      await api.slaFeriados.seedNacionais(clienteId);
      queryClient.invalidateQueries({ queryKey: ['admin_sla_feriados', clienteId] });
      toast.success('Feriados nacionais importados com sucesso');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao importar feriados');
    } finally {
      setSeedLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.data) { toast.error('Data obrigatória'); return; }
    if (!form.descricao.trim()) { toast.error('Descrição obrigatória'); return; }
    createMutation.mutate();
  };

  if (showForm) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="Novo Feriado"
          description="Adicione um feriado municipal ou nacional ao calendário do cliente."
        />
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
              <div className="space-y-1.5">
                <Label htmlFor="data">Data *</Label>
                <Input
                  id="data"
                  type="date"
                  value={form.data}
                  onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="descricao">Descrição *</Label>
                <Input
                  id="descricao"
                  value={form.descricao}
                  onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                  placeholder="Ex: Carnaval, Natal, Aniversário da cidade..."
                  required
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <Switch
                  id="recorrente"
                  checked={form.recorrente}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, recorrente: v }))}
                />
                <div>
                  <Label htmlFor="recorrente">Recorrente (nacional)</Label>
                  <p className="text-xs text-muted-foreground">Feriado que se repete todos os anos na mesma data.</p>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Cadastrar
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Feriados e Horário Comercial"
        description="Feriados são descontados do cálculo de SLA. Configure os feriados do seu município."
      />

      <div className="flex flex-wrap gap-3 justify-end">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={handleSeedNacionais}
          disabled={seedLoading}
        >
          {seedLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CalendarPlus className="w-4 h-4" />
          )}
          Importar feriados nacionais 2025
        </Button>
        <Button onClick={() => setShowForm(true)} size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> Novo feriado
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : feriados.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum feriado cadastrado. Clique em &ldquo;Importar feriados nacionais&rdquo; para começar.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Recorrente</TableHead>
                    <TableHead className="w-16 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feriados.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-mono text-sm">{formatDate(f.data)}</TableCell>
                      <TableCell>{f.descricao}</TableCell>
                      <TableCell>
                        {f.nacional ? (
                          <Badge variant="outline" className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 text-xs">
                            Nacional
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-muted/60 text-muted-foreground border-border text-xs">
                            Municipal
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setConfirmDialog({
                            title: 'Remover feriado?',
                            description: `O feriado "${f.descricao}" (${formatDate(f.data)}) será removido do calendário.`,
                            onConfirm: () => removeMutation.mutate(f.id),
                          })}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {feriados.map((f) => (
              <MobileListCard
                key={f.id}
                title={f.descricao}
                badges={
                  f.nacional ? (
                    <Badge variant="outline" className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 text-xs">
                      Nacional
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-muted/60 text-muted-foreground border-border text-xs">
                      Municipal
                    </Badge>
                  )
                }
                fields={[
                  { label: 'Data', value: formatDate(f.data) },
                ]}
                onDelete={() => setConfirmDialog({
                  title: 'Remover feriado?',
                  description: `O feriado "${f.descricao}" (${formatDate(f.data)}) será removido do calendário.`,
                  onConfirm: () => removeMutation.mutate(f.id),
                })}
              />
            ))}
          </div>
        </>
      )}

      {confirmDialog && (
        <ConfirmDialog
          open
          onOpenChange={(v) => { if (!v) setConfirmDialog(null); }}
          title={confirmDialog.title}
          description={confirmDialog.description}
          onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
        />
      )}
    </div>
  );
}
