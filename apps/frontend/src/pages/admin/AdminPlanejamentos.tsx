import { useState, useEffect, lazy, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useNavigate } from 'react-router-dom';
import { usePagination } from '@/hooks/usePagination';
import TablePagination from '@/components/TablePagination';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, Trash2, Search, CalendarIcon, ArrowLeft, Plane } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import AdminPageHeader from '@/components/AdminPageHeader';
import MobileListCard from '@/components/admin/MobileListCard';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import { Planejamento, Cliente, PlanejamentoTipo, PlanejamentoTipoLevantamento, Voo } from '@/types/database';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { type PlanejamentoGeoJSON } from '@/components/map/InspectionLeafletMap';

const DrawPolygonMap = lazy(() => import('@/components/map/DrawPolygonMap'));

const TIPO_LABELS: Record<PlanejamentoTipo, string> = {
  planejamento: 'Planejamento',
  execucao: 'Execução',
  realizado: 'Realizado',
};

const TIPO_LEVANTAMENTO_LABELS: Record<PlanejamentoTipoLevantamento, string> = {
  DRONE: 'DRONE',
  MANUAL: 'MANUAL',
};

const emptyForm = {
  descricao: '',
  data_planejamento: new Date(),
  cliente_id: '',
  area_total: '',
  altura_voo: '',
  area_geojson: null as PlanejamentoGeoJSON | null,
  tipo: '' as PlanejamentoTipo | '',
  tipo_entrada: 'MANUAL' as PlanejamentoTipoLevantamento,
  ativo: true,
};

const AdminPlanejamentos = () => {
  const navigate = useNavigate();
  const { clienteId, clientes } = useClienteAtivo();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Planejamento | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);

  const { data: planejamentos = [], isLoading: loading } = useQuery({
    queryKey: ['admin_planejamentos', clienteId],
    queryFn: async () => {
      try {
        return await api.planejamentos.listWithClienteByCliente(clienteId ?? null) as (Planejamento & { cliente?: Cliente })[];
      } catch (error) {
        toast.error('Erro ao carregar planejamentos');
        throw error;
      }
    },
    staleTime: 0,
  });

  const { data: droneCount = 0 } = useQuery({
    queryKey: ['imoveis_prio_drone', clienteId],
    queryFn: () => api.imoveis.countPrioridadeDroneByCliente(clienteId!),
    enabled: !!clienteId,
    staleTime: 5 * 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: { data: Record<string, unknown>; id?: string }) => {
      await api.planejamentos.upsert(payload.data, payload.id);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin_planejamentos', clienteId] });
      setShowForm(false);
      toast.success(variables.id ? 'Planejamento atualizado' : 'Planejamento criado');
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Erro ao salvar'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.planejamentos.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_planejamentos', clienteId] });
      toast.success('Planejamento excluído');
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Erro ao excluir'),
  });
  const [voosDoPlanejamento, setVoosDoPlanejamento] = useState<Voo[]>([]);
  const [loadingVoos, setLoadingVoos] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number] | undefined>(undefined);

  useEffect(() => {
    if (!showForm) return;
    const c = clientes.find((cl) => cl.id === form.cliente_id);
    setMapCenter(c?.latitude_centro != null && c?.longitude_centro != null ? [c.latitude_centro, c.longitude_centro] : undefined);
  }, [showForm, clientes, form.cliente_id]);


  const openCreate = () => {
    setEditing(null);
    const nextClienteId = clienteId || '';
    const c = clientes.find((cl) => cl.id === nextClienteId);
    setMapCenter(c?.latitude_centro != null && c?.longitude_centro != null ? [c.latitude_centro, c.longitude_centro] : undefined);
    setForm({ ...emptyForm, cliente_id: nextClienteId });
    setVoosDoPlanejamento([]);
    setShowForm(true);
  };

  const openEdit = (p: Planejamento & { cliente?: Cliente }) => {
    setEditing(p);
    setForm({
      descricao: p.descricao || '',
      data_planejamento: new Date(p.data_planejamento),
      cliente_id: p.cliente_id || '',
      area_total: p.area_total?.toString() || '',
      altura_voo: p.altura_voo?.toString() || '',
      area_geojson: (p.area as PlanejamentoGeoJSON) || null,
      tipo: p.tipo || '',
      tipo_entrada: (() => {
        const t = p.tipo_levantamento ?? p.tipo_entrada;
        return (t === 'DRONE' || t === 'MANUAL' ? t : 'MANUAL') as PlanejamentoTipoLevantamento;
      })(),
      ativo: p.ativo !== false,
    });
    const c = p.cliente ?? clientes.find((cl) => cl.id === p.cliente_id);
    setMapCenter(c?.latitude_centro != null && c?.longitude_centro != null ? [c.latitude_centro, c.longitude_centro] : undefined);
    setShowForm(true);
    // Fetch linked voos
    setLoadingVoos(true);
    api.planejamentos.voosByPlanejamento(p.id)
      .then((data) => { setVoosDoPlanejamento(data); setLoadingVoos(false); })
      .catch(() => setLoadingVoos(false));
  };

  const handleSave = () => {
    if (!form.descricao.trim()) { toast.error('Descrição é obrigatória'); return; }
    const payload: Record<string, unknown> = {
      descricao: form.descricao.trim(),
      data_planejamento: form.data_planejamento.toISOString(),
      cliente_id: form.cliente_id || null,
      area_total: form.area_total ? parseFloat(form.area_total) : null,
      altura_voo: form.altura_voo ? parseFloat(form.altura_voo) : null,
      area: form.area_geojson || null,
      tipo: form.tipo || null,
      tipo_levantamento: form.tipo_entrada || null,
      ativo: form.ativo,
    };
    saveMutation.mutate({ data: payload, ...(editing ? { id: editing.id } : {}) });
  };

  const handleDelete = (p: Planejamento) => {
    setConfirmDialog({
      title: 'Excluir planejamento',
      description: `Excluir planejamento "${p.descricao}"? Esta ação não pode ser desfeita.`,
      onConfirm: () => deleteMutation.mutate(p.id),
    });
  };

  const filtered = planejamentos.filter((p) =>
    (p.descricao || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.cliente?.nome || '').toLowerCase().includes(search.toLowerCase())
  );

  const { page, totalPages, paginated, goTo, next, prev, reset, total } = usePagination(filtered);

  if (showForm) {
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)] min-h-0 animate-fade-in overflow-hidden">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4 shrink-0">
          <div className="flex items-center gap-3 shrink-0">
            <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h2 className="text-base sm:text-lg font-semibold">{editing ? 'Editar Planejamento' : 'Novo Planejamento'}</h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {editing ? 'Atualize os dados do planejamento.' : 'Preencha os dados para criar um novo planejamento.'}
              </p>
            </div>
          </div>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editing ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <Card className="h-full flex flex-col rounded-sm border-2 border-cardBorder shadow-lg shadow-black/8 dark:shadow-black/20">
            <CardContent className="flex-1 min-h-0 p-0 overflow-hidden">
              <div className="flex flex-col lg:flex-row h-full">
                {/* Form Column */}
                <div className="w-full lg:w-[400px] xl:w-[450px] border-b lg:border-b-0 lg:border-r border-border shrink-0 p-4 xl:p-6 overflow-y-auto">
                  <div className="space-y-6">
                    {/* Dados básicos */}
                    <div className="space-y-4">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Dados Básicos</p>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Descrição *</Label>
                          <Textarea
                            value={form.descricao}
                            onChange={(e) => setForm((prev) => ({ ...prev, descricao: e.target.value }))}
                            placeholder="Descrição do planejamento"
                            rows={2}
                            className="resize-none"
                          />
                        </div>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Cliente</Label>
                            <Select value={form.cliente_id} onValueChange={(v) => {
                              setForm((prev) => ({ ...prev, cliente_id: v }));
                              const c = clientes.find((cl) => cl.id === v);
                              setMapCenter(c?.latitude_centro != null && c?.longitude_centro != null ? [c.latitude_centro, c.longitude_centro] : undefined);
                            }}>
                              <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                              <SelectContent>
                                {clientes.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Status</Label>
                              <Select value={form.tipo} onValueChange={(v) => setForm((prev) => ({ ...prev, tipo: v as PlanejamentoTipo }))}>
                                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="planejamento">Planejamento</SelectItem>
                                  <SelectItem value="execucao">Execução</SelectItem>
                                  <SelectItem value="realizado">Realizado</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Tipo Levantamento</Label>
                              <Select value={form.tipo_entrada} onValueChange={(v) => setForm((prev) => ({ ...prev, tipo_entrada: v as PlanejamentoTipoLevantamento }))}>
                                <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="DRONE">Drone</SelectItem>
                                  <SelectItem value="MANUAL">Manual</SelectItem>
                                </SelectContent>
                              </Select>
                              {form.tipo_entrada === 'DRONE' && droneCount > 0 && (
                                <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-[10px] mt-1">
                                  <Plane className="w-3 h-3 mr-1" />
                                  {droneCount} imóvel{droneCount !== 1 ? 'eis' : ''} inacessível{droneCount !== 1 ? 'eis' : ''} — drone sugerido
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Data</Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    className={cn("w-full justify-start text-left font-normal px-3", !form.data_planejamento && "text-muted-foreground")}
                                  >
                                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                                    <span className="truncate">
                                      {form.data_planejamento
                                        ? format(form.data_planejamento, 'dd/MM/yyyy', { locale: ptBR })
                                        : 'Selecionar'}
                                    </span>
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={form.data_planejamento}
                                    onSelect={(d) => d && setForm((prev) => ({ ...prev, data_planejamento: d }))}
                                    initialFocus
                                    className={cn("p-3 pointer-events-auto")}
                                  />
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>
                          <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                            <div>
                              <Label className="text-sm font-medium">Ativo</Label>
                              <p className="text-xs text-muted-foreground">Disponível para criar item manual (agente)</p>
                            </div>
                            <Switch
                              checked={form.ativo}
                              onCheckedChange={(v) => setForm((prev) => ({ ...prev, ativo: v }))}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <Separator className="opacity-50" />

                    {/* Parâmetros de voo */}
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Parâmetros de Voo</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Área Total (m²)</Label>
                          <Input type="number" step="any" value={form.area_total} onChange={(e) => setForm((prev) => ({ ...prev, area_total: e.target.value }))} placeholder="Ex: 1500" />
                        </div>
                        <div className="space-y-2">
                          <Label>Altura de Voo (m)</Label>
                          <Input type="number" step="any" value={form.altura_voo} onChange={(e) => setForm((prev) => ({ ...prev, altura_voo: e.target.value }))} placeholder="Ex: 120" />
                        </div>
                      </div>
                    </div>

                    {/* Voos vinculados */}
                    {editing && (
                      <>
                        <Separator className="opacity-50" />
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Plane className="h-3.5 w-3.5 text-muted-foreground" />
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Voos Vinculados</p>
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{voosDoPlanejamento.length}</Badge>
                          </div>
                          {loadingVoos ? (
                            <div className="flex justify-center py-4">
                              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                            </div>
                          ) : voosDoPlanejamento.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-2">Nenhum voo vinculado a este planejamento.</p>
                          ) : (
                            <div className="space-y-2">
                              {voosDoPlanejamento.map((v) => (
                                <div key={v.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="font-medium">Voo #{v.voo_numero ?? '—'}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {v.inicio ? format(new Date(v.inicio), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '—'}
                                      {v.duracao_min ? ` · ${v.duracao_min} min` : ''}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                      {v.ha != null && <span>{v.ha} ha</span>}
                                      {v.fotos != null && <span>{v.fotos} fotos</span>}
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => navigate('/admin/voos', { state: { editVooId: v.id } })} title="Editar voo">
                                      <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Map Column */}
                <div className="flex-1 h-full min-h-[400px] lg:min-h-0 relative">
                  <div className="absolute inset-0">
                    <Suspense fallback={
                      <div className="flex items-center justify-center h-full bg-muted/30">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      </div>
                    }>
                      <DrawPolygonMap
                        value={form.area_geojson}
                        onChange={(geojson) => setForm((prev) => ({ ...prev, area_geojson: geojson as PlanejamentoGeoJSON }))}
                        onAreaChange={(areaM2) => {
                          if (areaM2 != null) {
                            setForm((prev) => ({ ...prev, area_total: String(areaM2) }));
                          }
                        }}
                        center={mapCenter}
                        className="h-full w-full"
                        mapClassName="h-full w-full rounded-none"
                        hideLegend
                      />
                    </Suspense>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-4 overflow-x-hidden min-w-0 max-w-full">
      <ConfirmDialog
        open={!!confirmDialog}
        onOpenChange={(open) => { if (!open) setConfirmDialog(null); }}
        title={confirmDialog?.title ?? ''}
        description={confirmDialog?.description ?? ''}
        onConfirm={() => { confirmDialog?.onConfirm(); setConfirmDialog(null); }}
      />
      <AdminPageHeader title="Planejamentos" description="Gerencie os planejamentos de voo e inspeção." icon={CalendarIcon} />
      <div className="space-y-3 lg:space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por descrição ou cliente..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); reset(); }} />
          </div>
          <div className="flex items-center gap-2">
            {droneCount > 0 && (
              <Badge className="bg-blue-100 text-blue-700 border-blue-200 shrink-0">
                <Plane className="w-3 h-3 mr-1" />
                {droneCount} imóvel{droneCount !== 1 ? 'eis' : ''} marcado{droneCount !== 1 ? 's' : ''} para drone
              </Badge>
            )}
            <Button onClick={openCreate} className="w-full sm:w-auto gap-2">
              <Plus className="w-4 h-4" /> Novo Planejamento
            </Button>
          </div>
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
                  {paginated.map((p) => (
                    <MobileListCard
                      key={p.id}
                      title={p.descricao || '—'}
                      badges={
                        <span className="flex flex-wrap gap-1">
                          {p.tipo && (
                            <Badge variant={p.tipo === 'realizado' ? 'default' : p.tipo === 'execucao' ? 'secondary' : 'outline'}>
                              {TIPO_LABELS[p.tipo]}
                            </Badge>
                          )}
                          <Badge variant={p.ativo !== false ? 'default' : 'secondary'} className={p.ativo !== false ? 'bg-green-600' : ''}>
                            {p.ativo !== false ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </span>
                      }
                      fields={[
                        { label: 'Cliente', value: p.cliente?.nome },
                        { label: 'Data', value: format(new Date(p.data_planejamento), 'dd/MM/yyyy', { locale: ptBR }) },
                        { label: 'Tipo Levant.', value: (p.tipo_levantamento ?? p.tipo_entrada) ? TIPO_LEVANTAMENTO_LABELS[(p.tipo_levantamento ?? p.tipo_entrada)!] : null },
                        { label: 'Área Total', value: p.area_total ? `${p.area_total} m²` : null },
                      ]}
                      onEdit={() => openEdit(p)}
                      onDelete={() => handleDelete(p)}
                    />
                  ))}
                  {filtered.length === 0 && (
                    <p className="text-center py-12 text-muted-foreground text-sm">Nenhum planejamento encontrado</p>
                  )}
                </div>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Levantamento</TableHead>
                        <TableHead>Ativo</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Área Total</TableHead>
                        <TableHead>Altura Voo</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginated.map((p) => (
                        <TableRow key={p.id} className="group cursor-pointer hover:bg-muted/50" onClick={() => openEdit(p)}>
                          <TableCell className="font-medium">{p.descricao || '—'}</TableCell>
                          <TableCell>
                            {p.tipo ? (
                              <Badge variant={p.tipo === 'realizado' ? 'default' : p.tipo === 'execucao' ? 'secondary' : 'outline'}>
                                {TIPO_LABELS[p.tipo]}
                              </Badge>
                            ) : '—'}
                          </TableCell>
                          <TableCell>
                            {(p.tipo_levantamento ?? p.tipo_entrada) ? (
                              <Badge variant="outline">{TIPO_LEVANTAMENTO_LABELS[(p.tipo_levantamento ?? p.tipo_entrada)!]}</Badge>
                            ) : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={p.ativo !== false ? 'default' : 'secondary'} className={p.ativo !== false ? 'bg-green-600' : ''}>
                              {p.ativo !== false ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{p.cliente?.nome || '—'}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {format(new Date(p.data_planejamento), 'dd/MM/yyyy', { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{p.area_total ?? '—'}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{p.altura_voo ? `${p.altura_voo}m` : '—'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(p); }}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(p); }} className="text-destructive hover:text-destructive">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filtered.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                            Nenhum planejamento encontrado
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
    </div>
  );
};

export default AdminPlanejamentos;
