import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { SentinelaRiskPolicy } from '@/types/database';
import AdminPageHeader from '@/components/AdminPageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import MobileListCard from '@/components/admin/MobileListCard';
import TablePagination from '@/components/TablePagination';
import { usePagination } from '@/hooks/usePagination';
import { Plus, Search, Pencil, Trash2, Loader2, ShieldCheck, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { PolicyEditor } from '@/components/risk-policy/PolicyEditor';
import { DroneRiskConfigTab } from '@/components/risk-policy/DroneRiskConfigTab';
import { seedDefaultRiskPolicy } from '@/lib/seedDefaultRiskPolicy';
import ConfirmDialog from '@/components/admin/ConfirmDialog';

const AdminRiskPolicy = () => {
  const { clienteId } = useClienteAtivo();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editingPolicy, setEditingPolicy] = useState<SentinelaRiskPolicy | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);

  const { data: policies = [], isLoading: loading } = useQuery({
    queryKey: ['admin_risk_policy', clienteId],
    queryFn: async () => {
      if (!clienteId) return [];
      return api.riskPolicy.listByCliente(clienteId);
    },
    staleTime: 0,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.riskPolicy.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_risk_policy', clienteId] });
      toast.success('Política excluída');
    },
    onError: () => toast.error('Erro ao excluir'),
  });

  const handleDelete = (id: string) => {
    setConfirmDialog({
      title: 'Excluir política',
      description: 'Excluir esta política e todos os dados relacionados? Esta ação não pode ser desfeita.',
      onConfirm: () => deleteMutation.mutate(id),
    });
  };

  const handleSeedAll = () => {
    setConfirmDialog({
      title: 'Criar políticas padrão',
      description: 'Criar política de risco padrão para todos os clientes que ainda não possuem uma?',
      onConfirm: async () => {
        try {
          const [allClientes, existingClienteIds] = await Promise.all([
            api.clientes.list(),
            api.riskPolicy.listAllClienteIds(),
          ]);

          const existingSet = new Set(existingClienteIds);
          const missing = allClientes.filter(c => !existingSet.has(c.id));

          if (missing.length === 0) {
            toast.info('Todos os clientes já possuem política de risco.');
            return;
          }

          for (const c of missing) {
            await seedDefaultRiskPolicy(c.id);
          }
          toast.success(`Política padrão criada para ${missing.length} cliente(s).`);
          queryClient.invalidateQueries({ queryKey: ['admin_risk_policy', clienteId] });
        } catch (err) {
          console.error(err);
          toast.error('Erro ao criar políticas em lote.');
        }
      },
    });
  };

  const handleSaved = () => {
    setEditingPolicy(null);
    setCreating(false);
    queryClient.invalidateQueries({ queryKey: ['admin_risk_policy', clienteId] });
  };

  const filtered = policies.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.version.toLowerCase().includes(search.toLowerCase())
  );

  const { page, totalPages, paginated, goTo, next, prev, reset, total } = usePagination(filtered);

  if (creating || editingPolicy) {
    return (
      <PolicyEditor
        policy={editingPolicy}
        clienteId={clienteId!}
        onBack={() => { setEditingPolicy(null); setCreating(false); }}
        onSaved={handleSaved}
      />
    );
  }

  return (
    <div className="space-y-3 lg:space-y-4">
      <ConfirmDialog
        open={!!confirmDialog}
        onOpenChange={(open) => { if (!open) setConfirmDialog(null); }}
        title={confirmDialog?.title ?? ''}
        description={confirmDialog?.description ?? ''}
        onConfirm={() => { confirmDialog?.onConfirm(); setConfirmDialog(null); }}
      />
      <AdminPageHeader
        title="Políticas de Risco"
        description="Configuração de regras e parâmetros de risco."
        icon={ShieldCheck}
      />

      <Tabs defaultValue="pluvio">
        <TabsList className="mb-2">
          <TabsTrigger value="pluvio">Pluviométrica</TabsTrigger>
          <TabsTrigger value="drone">Drone / YOLO</TabsTrigger>
        </TabsList>

        {/* ── Aba Pluviométrica (conteúdo original) ── */}
        <TabsContent value="pluvio" className="mt-3 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou versão..."
                className="pl-9"
                value={search}
                onChange={e => { setSearch(e.target.value); reset(); }}
              />
            </div>
            <Button onClick={() => setCreating(true)} disabled={!clienteId} className="w-full sm:w-auto gap-2">
              <Plus className="w-4 h-4" />
              Nova Política
            </Button>
            <Button variant="outline" onClick={handleSeedAll} className="w-full sm:w-auto gap-2">
              <Wand2 className="w-4 h-4" />
              Popular Todos
            </Button>
          </div>

          <Card className="card-premium overflow-hidden">
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="md:hidden p-3 space-y-3">
                    {paginated.map(p => (
                      <MobileListCard
                        key={p.id}
                        title={p.name}
                        fields={[
                          { label: 'Versão', value: p.version },
                        ]}
                        badges={
                          <Badge variant={p.is_active ? 'default' : 'secondary'}>
                            {p.is_active ? 'Ativa' : 'Inativa'}
                          </Badge>
                        }
                        onEdit={() => setEditingPolicy(p)}
                        onDelete={() => handleDelete(p.id)}
                      />
                    ))}
                    {filtered.length === 0 && (
                      <p className="text-center py-12 text-muted-foreground text-sm">Nenhuma política encontrada</p>
                    )}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Versão</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginated.map(p => (
                          <TableRow key={p.id} className="group cursor-pointer hover:bg-muted/50" onClick={() => setEditingPolicy(p)}>
                            <TableCell className="font-medium">{p.name}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{p.version}</TableCell>
                            <TableCell>
                              <Badge variant={p.is_active ? 'default' : 'secondary'}>
                                {p.is_active ? 'Ativa' : 'Inativa'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-1 justify-end">
                                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditingPolicy(p); }}>
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {filtered.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                              Nenhuma política encontrada
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
        </TabsContent>

        {/* ── Aba Drone / YOLO ── */}
        <TabsContent value="drone" className="mt-3">
          <DroneRiskConfigTab clienteId={clienteId!} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminRiskPolicy;
