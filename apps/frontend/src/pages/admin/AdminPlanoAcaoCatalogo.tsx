import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import { PlanoAcaoCatalogo } from '@/types/database';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, Trash2, ArrowLeft } from 'lucide-react';
import AdminPageHeader from '@/components/AdminPageHeader';
import MobileListCard from '@/components/admin/MobileListCard';
import ConfirmDialog from '@/components/admin/ConfirmDialog';

const emptyForm = {
  label: '',
  descricao: '',
  tipo_item: '',
  ativo: true,
  ordem: 0,
};

export default function AdminPlanoAcaoCatalogo() {
  const { clienteId } = useClienteAtivo();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PlanoAcaoCatalogo | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);

  const { data: planos = [], isLoading: loading } = useQuery({
    queryKey: ['admin_plano_acao_catalogo', clienteId],
    queryFn: () => {
      if (!clienteId) return Promise.resolve([] as PlanoAcaoCatalogo[]);
      return api.planoAcaoCatalogo.listAllByCliente(clienteId);
    },
    enabled: !!clienteId,
    staleTime: STALE.MEDIUM,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!clienteId) throw new Error('Cliente não selecionado');
      if (editing) {
        await api.planoAcaoCatalogo.update(editing.id, {
          label: form.label.trim(),
          descricao: form.descricao.trim() || null,
          tipo_item: form.tipo_item.trim() || null,
          ativo: form.ativo,
          ordem: form.ordem,
        });
      } else {
        await api.planoAcaoCatalogo.create({
          cliente_id: clienteId,
          label: form.label.trim(),
          descricao: form.descricao.trim() || null,
          tipo_item: form.tipo_item.trim() || null,
          ordem: form.ordem,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_plano_acao_catalogo', clienteId] });
      setShowForm(false);
      toast.success(editing ? 'Plano atualizado' : 'Plano cadastrado');
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Erro ao salvar'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.planoAcaoCatalogo.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_plano_acao_catalogo', clienteId] });
      toast.success('Plano excluído');
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Erro ao excluir'),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, ordem: planos.length });
    setShowForm(true);
  };

  const openEdit = (p: PlanoAcaoCatalogo) => {
    setEditing(p);
    setForm({
      label: p.label,
      descricao: p.descricao || '',
      tipo_item: p.tipo_item || '',
      ativo: p.ativo,
      ordem: p.ordem,
    });
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.label.trim()) { toast.error('Título obrigatório'); return; }
    saveMutation.mutate();
  };

  if (showForm) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title={editing ? 'Editar Plano de Ação' : 'Novo Plano de Ação'}
          description={editing ? `Editando: ${editing.label}` : 'Cadastre uma ação padronizada para o catálogo do cliente.'}
        />
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
              <div className="space-y-1.5">
                <Label htmlFor="label">Título *</Label>
                <Input
                  id="label"
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="Ex: Eliminar depósito de água parada"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  value={form.descricao}
                  onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                  placeholder="Instruções detalhadas para execução desta ação..."
                  rows={3}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tipo_item">Tipo de problema</Label>
                <Input
                  id="tipo_item"
                  value={form.tipo_item}
                  onChange={(e) => setForm((f) => ({ ...f, tipo_item: e.target.value }))}
                  placeholder="Ex: pneu, caixa_dagua, lixo (deixe vazio para genérico)"
                />
                <p className="text-xs text-muted-foreground">Filtro por tipo de item. Deixe vazio para ação genérica (aparece para qualquer tipo).</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ordem">Ordem de exibição</Label>
                <Input
                  id="ordem"
                  type="number"
                  min={0}
                  value={form.ordem}
                  onChange={(e) => setForm((f) => ({ ...f, ordem: Number(e.target.value) }))}
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <Switch
                  id="ativo"
                  checked={form.ativo}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))}
                />
                <Label htmlFor="ativo">Ativo</Label>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editing ? 'Salvar alterações' : 'Cadastrar'}
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
        title="Catálogo de Planos de Ação"
        description="Ações padronizadas que podem ser aplicadas aos itens identificados em campo."
      />

      <div className="flex justify-end">
        <Button onClick={openCreate} size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> Novo plano
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : planos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum plano de ação cadastrado.
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
                    <TableHead>Título</TableHead>
                    <TableHead>Tipo de Problema</TableHead>
                    <TableHead>Ordem</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {planos.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{p.label}</p>
                          {p.descricao && (
                            <p className="text-xs text-muted-foreground truncate max-w-xs">{p.descricao}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {p.tipo_item ? (
                          <Badge variant="outline" className="text-xs">{p.tipo_item}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">Genérico</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{p.ordem}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={p.ativo
                          ? 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30'
                          : 'bg-muted/60 text-muted-foreground border-border'
                        }>
                          {p.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setConfirmDialog({
                              title: 'Excluir plano de ação?',
                              description: `O plano "${p.label}" será removido permanentemente.`,
                              onConfirm: () => removeMutation.mutate(p.id),
                            })}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {planos.map((p) => (
              <MobileListCard
                key={p.id}
                title={p.label}
                badges={
                  <>
                    {p.tipo_item && <Badge variant="outline" className="text-xs">{p.tipo_item}</Badge>}
                    <Badge variant="outline" className={p.ativo
                      ? 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30'
                      : 'bg-muted/60 text-muted-foreground border-border'
                    }>
                      {p.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </>
                }
                fields={[
                  { label: 'Descrição', value: p.descricao || '—' },
                  { label: 'Tipo', value: p.tipo_item || 'Genérico' },
                ]}
                onEdit={() => openEdit(p)}
                onDelete={() => setConfirmDialog({
                  title: 'Excluir plano de ação?',
                  description: `O plano "${p.label}" será removido permanentemente.`,
                  onConfirm: () => removeMutation.mutate(p.id),
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
