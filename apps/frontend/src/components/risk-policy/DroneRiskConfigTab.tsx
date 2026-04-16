import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import {
  SentinelaDroneRiskConfig,
  SentinelaYoloClassConfig,
  SentinelaYoloSynonym,
  DroneRisco,
  DronePrioridade,
} from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Pencil, Trash2, Plus, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileListCard from '@/components/admin/MobileListCard';
import ConfirmDialog from '@/components/admin/ConfirmDialog';

const RISCO_OPTIONS: DroneRisco[] = ['baixo', 'medio', 'alto'];
const PRIORIDADE_OPTIONS: DronePrioridade[] = ['P1', 'P2', 'P3', 'P4', 'P5'];

const RISCO_BADGE: Record<DroneRisco, string> = {
  baixo:  'bg-green-100 text-green-800',
  medio:  'bg-yellow-100 text-yellow-800',
  alto:   'bg-red-100 text-red-800',
};

interface Props {
  clienteId: string;
}

// ─── Scoring Config ───────────────────────────────────────────────────────────

function ScoringConfigSection({ clienteId }: Props) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<SentinelaDroneRiskConfig>>({});

  const { data: config, isLoading } = useQuery({
    queryKey: ['drone_risk_config', clienteId],
    queryFn: () => api.droneRiskConfig.getByCliente(clienteId),
    enabled: !!clienteId,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<SentinelaDroneRiskConfig>) => {
      await api.droneRiskConfig.update(clienteId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drone_risk_config', clienteId] });
      toast.success('Configuração salva');
      setEditing(false);
    },
    onError: () => toast.error('Erro ao salvar configuração'),
  });

  const handleEdit = () => {
    if (!config) return;
    setForm({
      base_by_risco: { ...config.base_by_risco },
      priority_thresholds: { ...config.priority_thresholds },
      sla_by_priority_hours: { ...config.sla_by_priority_hours },
      confidence_multiplier: config.confidence_multiplier,
    });
    setEditing(true);
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  if (!config) return <p className="text-sm text-muted-foreground py-4">Nenhuma configuração encontrada para este cliente.</p>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-primary">Parâmetros de Scoring</CardTitle>
        {!editing && (
          <Button variant="outline" size="sm" onClick={handleEdit} className="gap-1">
            <Pencil className="w-3 h-3" /> Editar
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {/* base_by_risco */}
        <div>
          <p className="text-xs text-muted-foreground mb-1 font-medium">Score base por nível de risco</p>
          <div className="grid grid-cols-3 gap-2">
            {RISCO_OPTIONS.map(r => (
              <div key={r} className="space-y-0.5">
                <label className="text-xs capitalize text-muted-foreground">{r}</label>
                {editing ? (
                  <Input
                    type="number" min={0} max={100}
                    value={form.base_by_risco?.[r] ?? ''}
                    onChange={e => setForm(f => ({
                      ...f,
                      base_by_risco: { ...f.base_by_risco as Record<DroneRisco, number>, [r]: Number(e.target.value) },
                    }))}
                    className="h-8 text-sm"
                  />
                ) : (
                  <div className="h-8 flex items-center px-3 border rounded-md text-sm bg-muted/30">
                    {config.base_by_risco[r]}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* priority_thresholds */}
        <div>
          <p className="text-xs text-muted-foreground mb-1 font-medium">Thresholds de prioridade (score mínimo)</p>
          <div className="grid grid-cols-5 gap-1.5">
            {PRIORIDADE_OPTIONS.map(p => (
              <div key={p} className="space-y-0.5">
                <label className="text-xs text-muted-foreground">{p}</label>
                {editing ? (
                  <Input
                    type="number" min={0} max={100}
                    value={form.priority_thresholds?.[p] ?? ''}
                    onChange={e => setForm(f => ({
                      ...f,
                      priority_thresholds: { ...f.priority_thresholds as Record<DronePrioridade, number>, [p]: Number(e.target.value) },
                    }))}
                    className="h-8 text-sm"
                  />
                ) : (
                  <div className="h-8 flex items-center px-3 border rounded-md text-sm bg-muted/30">
                    {config.priority_thresholds[p]}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* sla_by_priority_hours */}
        <div>
          <p className="text-xs text-muted-foreground mb-1 font-medium">SLA em horas por prioridade</p>
          <div className="grid grid-cols-5 gap-1.5">
            {PRIORIDADE_OPTIONS.map(p => (
              <div key={p} className="space-y-0.5">
                <label className="text-xs text-muted-foreground">{p}</label>
                {editing ? (
                  <Input
                    type="number" min={1}
                    value={form.sla_by_priority_hours?.[p] ?? ''}
                    onChange={e => setForm(f => ({
                      ...f,
                      sla_by_priority_hours: { ...f.sla_by_priority_hours as Record<DronePrioridade, number>, [p]: Number(e.target.value) },
                    }))}
                    className="h-8 text-sm"
                  />
                ) : (
                  <div className="h-8 flex items-center px-3 border rounded-md text-sm bg-muted/30">
                    {config.sla_by_priority_hours[p]}h
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {editing && (
          <div className="flex gap-2 pt-0">
            <Button size="sm" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} className="gap-1">
              {saveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Salvar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="gap-1">
              <X className="w-3 h-3" /> Cancelar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── YOLO Classes ─────────────────────────────────────────────────────────────

function YoloClassesSection({ clienteId }: Props) {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<SentinelaYoloClassConfig>>({});
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ['drone_yolo_classes', clienteId],
    queryFn: () => api.droneRiskConfig.listYoloClasses(clienteId),
    enabled: !!clienteId,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<SentinelaYoloClassConfig> }) => {
      await api.droneRiskConfig.updateYoloClass(id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drone_yolo_classes', clienteId] });
      toast.success('Classe atualizada');
      setEditingId(null);
    },
    onError: () => toast.error('Erro ao atualizar classe'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      await api.droneRiskConfig.updateYoloClass(id, { is_active });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['drone_yolo_classes', clienteId] }),
    onError: () => toast.error('Erro ao alterar status'),
  });

  const handleEdit = (c: SentinelaYoloClassConfig) => {
    setEditingId(c.id);
    setEditForm({ risco: c.risco, peso: c.peso, acao: c.acao ?? '' });
  };

  const handleSave = (id: string) => {
    updateMutation.mutate({ id, payload: editForm });
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <>
      <ConfirmDialog
        open={!!confirmDialog}
        onOpenChange={(open) => { if (!open) setConfirmDialog(null); }}
        title={confirmDialog?.title ?? ''}
        description={confirmDialog?.description ?? ''}
        onConfirm={() => { confirmDialog?.onConfirm(); setConfirmDialog(null); }}
      />
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-primary">Classes YOLO</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Mobile */}
          <div className="md:hidden p-3 space-y-3">
            {classes.map(c => (
              editingId === c.id ? (
                <Card key={c.id} className="p-3 space-y-3 border-primary">
                  <p className="text-sm font-medium">{c.item_key}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Risco</label>
                      <Select value={editForm.risco} onValueChange={v => setEditForm(f => ({ ...f, risco: v as DroneRisco }))}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {RISCO_OPTIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Peso (0-100)</label>
                      <Input type="number" min={0} max={100} value={editForm.peso ?? ''} onChange={e => setEditForm(f => ({ ...f, peso: Number(e.target.value) }))} className="h-8 text-sm" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Ação recomendada</label>
                    <Input value={editForm.acao ?? ''} onChange={e => setEditForm(f => ({ ...f, acao: e.target.value }))} className="h-8 text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleSave(c.id)} disabled={updateMutation.isPending} className="gap-1">
                      {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Salvar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="gap-1">
                      <X className="w-3 h-3" /> Cancelar
                    </Button>
                  </div>
                </Card>
              ) : (
                <MobileListCard
                  key={c.id}
                  title={c.item_key}
                  fields={[
                    { label: 'Peso', value: String(c.peso) },
                    { label: 'Ação', value: c.acao ?? '—' },
                  ]}
                  badges={
                    <Badge className={RISCO_BADGE[c.risco]}>{c.risco}</Badge>
                  }
                  onEdit={() => handleEdit(c)}
                />
              )
            ))}
          </div>

          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Classe YOLO</TableHead>
                  <TableHead>Risco</TableHead>
                  <TableHead>Peso</TableHead>
                  <TableHead>Ação recomendada</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Editar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classes.map(c => (
                  <TableRow key={c.id} className={!c.is_active ? 'opacity-50' : ''}>
                    <TableCell className="font-mono text-sm">{c.item_key}</TableCell>
                    <TableCell>
                      {editingId === c.id ? (
                        <Select value={editForm.risco} onValueChange={v => setEditForm(f => ({ ...f, risco: v as DroneRisco }))}>
                          <SelectTrigger className="h-8 w-28 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {RISCO_OPTIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={RISCO_BADGE[c.risco]}>{c.risco}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === c.id ? (
                        <Input type="number" min={0} max={100} value={editForm.peso ?? ''} onChange={e => setEditForm(f => ({ ...f, peso: Number(e.target.value) }))} className="h-8 w-20 text-sm" />
                      ) : (
                        <span className="text-sm">{c.peso}</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      {editingId === c.id ? (
                        <Input value={editForm.acao ?? ''} onChange={e => setEditForm(f => ({ ...f, acao: e.target.value }))} className="h-8 text-sm" />
                      ) : (
                        <span className="text-sm text-muted-foreground truncate block max-w-xs" title={c.acao ?? ''}>{c.acao ?? '—'}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => toggleActiveMutation.mutate({ id: c.id, is_active: !c.is_active })}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {c.is_active ? 'Ativa' : 'Inativa'}
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId === c.id ? (
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" onClick={() => handleSave(c.id)} disabled={updateMutation.isPending}>
                            {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button size="icon" variant="ghost" onClick={() => handleEdit(c)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// ─── Synonyms ─────────────────────────────────────────────────────────────────

function SynonymsSection({ clienteId }: Props) {
  const queryClient = useQueryClient();
  const [newSynonym, setNewSynonym] = useState('');
  const [newMapsTo, setNewMapsTo] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);

  const { data: synonyms = [], isLoading } = useQuery({
    queryKey: ['drone_yolo_synonyms', clienteId],
    queryFn: () => api.droneRiskConfig.listSynonyms(clienteId),
    enabled: !!clienteId,
  });

  const addMutation = useMutation({
    mutationFn: async ({ synonym, maps_to }: { synonym: string; maps_to: string }) => {
      await api.droneRiskConfig.addSynonym(clienteId, synonym, maps_to);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drone_yolo_synonyms', clienteId] });
      toast.success('Sinônimo adicionado');
      setNewSynonym('');
      setNewMapsTo('');
    },
    onError: () => toast.error('Erro ao adicionar sinônimo'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.droneRiskConfig.deleteSynonym(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drone_yolo_synonyms', clienteId] });
      toast.success('Sinônimo removido');
    },
    onError: () => toast.error('Erro ao remover sinônimo'),
  });

  const handleAdd = () => {
    if (!newSynonym.trim() || !newMapsTo.trim()) {
      toast.error('Preencha o sinônimo e o destino');
      return;
    }
    addMutation.mutate({ synonym: newSynonym, maps_to: newMapsTo });
  };

  const handleDelete = (id: string, synonym: string) => {
    setConfirmDialog({
      title: 'Remover sinônimo',
      description: `Remover o sinônimo "${synonym}"?`,
      onConfirm: () => deleteMutation.mutate(id),
    });
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>;

  return (
    <>
      <ConfirmDialog
        open={!!confirmDialog}
        onOpenChange={(open) => { if (!open) setConfirmDialog(null); }}
        title={confirmDialog?.title ?? ''}
        description={confirmDialog?.description ?? ''}
        onConfirm={() => { confirmDialog?.onConfirm(); setConfirmDialog(null); }}
      />
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-primary">Sinônimos YOLO</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Add row */}
          <div className="flex gap-2">
            <Input
              placeholder="Sinônimo (ex: pneu_velho)"
              value={newSynonym}
              onChange={e => setNewSynonym(e.target.value)}
              className="h-8 text-sm font-mono"
            />
            <span className="flex items-center text-muted-foreground text-sm">→</span>
            <Input
              placeholder="Mapeia para (ex: pneu)"
              value={newMapsTo}
              onChange={e => setNewMapsTo(e.target.value)}
              className="h-8 text-sm font-mono"
            />
            <Button size="sm" onClick={handleAdd} disabled={addMutation.isPending} className="gap-1 shrink-0">
              {addMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Adicionar
            </Button>
          </div>

          {/* List */}
          {synonyms.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum sinônimo cadastrado</p>
          ) : (
            <div className="divide-y rounded-md border overflow-hidden">
              {synonyms.map(s => (
                <div key={s.id} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm font-mono">
                    <span className="text-foreground">{s.synonym}</span>
                    <span className="text-muted-foreground mx-2">→</span>
                    <span className="text-foreground">{s.maps_to}</span>
                  </span>
                  <Button
                    size="icon" variant="ghost"
                    onClick={() => handleDelete(s.id, s.synonym)}
                    className="h-7 w-7 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ─── Main Tab Component ───────────────────────────────────────────────────────

export function DroneRiskConfigTab({ clienteId }: Props) {
  if (!clienteId) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Selecione um cliente para ver a configuração.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <ScoringConfigSection clienteId={clienteId} />
      <YoloClassesSection clienteId={clienteId} />
      <SynonymsSection clienteId={clienteId} />
    </div>
  );
}
