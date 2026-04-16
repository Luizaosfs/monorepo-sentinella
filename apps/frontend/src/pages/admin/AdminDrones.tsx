import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { api } from '@/services/api';
import { usePagination } from '@/hooks/usePagination';
import TablePagination from '@/components/TablePagination';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, Trash2, Search, ArrowLeft } from 'lucide-react';
import { IconDrone } from '@/components/icons/IconDrone';
import { Drone, type DroneProprietario } from '@/types/database';
import AdminPageHeader from '@/components/AdminPageHeader';
import MobileListCard from '@/components/admin/MobileListCard';
import ConfirmDialog from '@/components/admin/ConfirmDialog';

const emptyForm = {
  marca: '',
  modelo: '',
  baterias: '',
  specs: '',
  proprietario: 'proprio' as DroneProprietario,
  ativo: true,
};

const AdminDrones = () => {
  const { isAdmin } = useAuth();
  const { clienteId } = useClienteAtivo();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Drone | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);

  const { data: drones = [], isLoading: loading } = useQuery({
    queryKey: ['admin_drones', clienteId],
    queryFn: () => api.drones.list(clienteId!),
    enabled: !!clienteId,
    staleTime: 0,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: typeof emptyForm & { id?: string }) => {
      const { id, ...data } = payload;
      if (id) {
        await api.drones.update(id, data);
      } else {
        await api.drones.create({ ...data, cliente_id: clienteId! });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_drones'] });
      setShowForm(false);
      toast.success(editing ? 'Drone atualizado' : 'Drone cadastrado');
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Erro ao salvar'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.drones.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_drones'] });
      toast.success('Drone excluído');
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Erro ao excluir'),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (d: Drone) => {
    setEditing(d);
    setForm({
      marca: d.marca,
      modelo: d.modelo,
      baterias: d.baterias,
      specs: d.specs,
      proprietario: d.proprietario,
      ativo: d.ativo,
    });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.marca.trim()) { toast.error('Marca é obrigatória'); return; }
    if (!form.modelo.trim()) { toast.error('Modelo é obrigatório'); return; }
    if (!form.baterias.trim()) { toast.error('Baterias é obrigatório'); return; }
    if (!form.specs.trim()) { toast.error('Especificações é obrigatório'); return; }
    saveMutation.mutate({
      ...form,
      marca: form.marca.trim(),
      modelo: form.modelo.trim(),
      baterias: form.baterias.trim(),
      specs: form.specs.trim(),
      ...(editing ? { id: editing.id } : {}),
    });
  };

  const handleDelete = (d: Drone) => {
    setConfirmDialog({
      title: 'Excluir drone',
      description: `Excluir o drone ${d.marca} ${d.modelo}? Esta ação não pode ser desfeita.`,
      onConfirm: () => deleteMutation.mutate(d.id),
    });
  };

  const filtered = drones.filter(
    (d) =>
      d.marca.toLowerCase().includes(search.toLowerCase()) ||
      d.modelo.toLowerCase().includes(search.toLowerCase()) ||
      d.baterias.toLowerCase().includes(search.toLowerCase()) ||
      d.specs.toLowerCase().includes(search.toLowerCase())
  );

  const { page, totalPages, paginated, goTo, next, prev, reset, total } = usePagination(filtered);

  if (showForm) {
    return (
      <div className="space-y-4 lg:space-y-4 animate-fade-in">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold">{editing ? 'Editar Drone' : 'Novo Drone'}</h2>
            <p className="text-sm text-muted-foreground">
              {editing ? 'Atualize os dados do drone.' : 'Preencha os dados para cadastrar um novo drone.'}
            </p>
          </div>
        </div>

        <Card className="rounded-sm border-2 border-cardBorder shadow-lg shadow-black/8 dark:shadow-black/20">
          <CardContent className="p-6">
            <div className="grid gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Marca *</Label>
                  <Input
                    value={form.marca}
                    onChange={(e) => setForm((p) => ({ ...p, marca: e.target.value }))}
                    placeholder="Ex: DJI"
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Modelo *</Label>
                  <Input
                    value={form.modelo}
                    onChange={(e) => setForm((p) => ({ ...p, modelo: e.target.value }))}
                    placeholder="Ex: Phantom 4 Pro"
                    maxLength={100}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Baterias *</Label>
                <Input
                  value={form.baterias}
                  onChange={(e) => setForm((p) => ({ ...p, baterias: e.target.value }))}
                  placeholder="Ex: 2x 5870 mAh"
                  maxLength={200}
                />
              </div>
              <div className="space-y-2">
                <Label>Especificações *</Label>
                <Textarea
                  value={form.specs}
                  onChange={(e) => setForm((p) => ({ ...p, specs: e.target.value }))}
                  placeholder="Especificações técnicas, câmera, autonomia, etc."
                  rows={3}
                  className="resize-none"
                />
              </div>
              <div className="space-y-2">
                <Label>Proprietário</Label>
                <Select
                  value={form.proprietario}
                  onValueChange={(v) => setForm((p) => ({ ...p, proprietario: v as DroneProprietario }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="proprio">Próprio</SelectItem>
                    <SelectItem value="terceiro">Terceiro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <Label htmlFor="drone-ativo" className="cursor-pointer">Ativo</Label>
                <Switch
                  id="drone-ativo"
                  checked={form.ativo}
                  onCheckedChange={(v) => setForm((p) => ({ ...p, ativo: v }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {editing ? 'Salvar' : 'Cadastrar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-4">
      <ConfirmDialog
        open={!!confirmDialog}
        onOpenChange={(open) => { if (!open) setConfirmDialog(null); }}
        title={confirmDialog?.title ?? ''}
        description={confirmDialog?.description ?? ''}
        onConfirm={() => { confirmDialog?.onConfirm(); setConfirmDialog(null); }}
      />
      <AdminPageHeader
        title="Drones"
        description="Cadastro de drones para inspeção aérea."
        icon={IconDrone}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por marca, modelo, baterias ou specs..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); reset(); }}
          />
        </div>
        <Button onClick={openCreate} className="w-full sm:w-auto gap-2">
          <Plus className="w-4 h-4" />
          Novo Drone
        </Button>
      </div>

      <Card className="rounded-sm border-2 border-cardBorder shadow-lg shadow-black/8 dark:shadow-black/20 overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Mobile/Tablet cards */}
              <div className="md:hidden p-3 space-y-3">
                {paginated.map((d) => (
                  <MobileListCard
                    key={d.id}
                    title={`${d.marca} ${d.modelo}`}
                    badges={
                      <>
                        <Badge variant={d.proprietario === 'proprio' ? 'default' : 'secondary'}>
                          {d.proprietario === 'proprio' ? 'Próprio' : 'Terceiro'}
                        </Badge>
                        <Badge variant={d.ativo ? 'default' : 'outline'}>
                          {d.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </>
                    }
                    fields={[
                      { label: 'Baterias', value: d.baterias },
                      { label: 'Specs', value: <span className="line-clamp-2">{d.specs}</span> },
                    ]}
                    onEdit={() => openEdit(d)}
                    onDelete={isAdmin ? () => handleDelete(d) : undefined}
                  />
                ))}
                {filtered.length === 0 && (
                  <p className="text-center py-12 text-muted-foreground text-sm">Nenhum drone encontrado</p>
                )}
              </div>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Marca</TableHead>
                      <TableHead>Modelo</TableHead>
                      <TableHead>Baterias</TableHead>
                      <TableHead>Proprietário</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((d) => (
                      <TableRow key={d.id} className="group cursor-pointer hover:bg-muted/50" onClick={() => openEdit(d)}>
                        <TableCell className="font-medium">{d.marca}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{d.modelo}</TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-[120px] truncate" title={d.baterias}>
                          {d.baterias}
                        </TableCell>
                        <TableCell>
                          <Badge variant={d.proprietario === 'proprio' ? 'default' : 'secondary'}>
                            {d.proprietario === 'proprio' ? 'Próprio' : 'Terceiro'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={d.ativo ? 'default' : 'outline'}>
                            {d.ativo ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(d); }}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => { e.stopPropagation(); handleDelete(d); }}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                          Nenhum drone encontrado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
          <TablePagination page={page} totalPages={totalPages} total={total} onGoTo={goTo} onNext={next} onPrev={prev} />
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDrones;
