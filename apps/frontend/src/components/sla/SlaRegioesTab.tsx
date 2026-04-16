import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useSlaConfigRegiao, useSlaConfigRegiaoMutations } from '@/hooks/queries/useSlaConfigRegiao';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, Trash2, MapPin } from 'lucide-react';
import { SlaConfigJson, DEFAULT_SLA_CONFIG } from '@/types/sla-config';
import { SlaConfigRegiao } from '@/types/database';
import { Regiao } from '@/types/database';

const PRIORIDADES = ['Crítica', 'Urgente', 'Alta', 'Média', 'Moderada', 'Baixa', 'Monitoramento'] as const;

interface Props {
  clienteId: string | null;
}

// ── Edit dialog ───────────────────────────────────────────────────────────────
function EditRegiaoDialog({
  clienteId,
  existing,
  regioes,
  onClose,
}: {
  clienteId: string;
  existing: SlaConfigRegiao | null;
  regioes: Pick<Regiao, 'id' | 'regiao'>[];
  onClose: () => void;
}) {
  const { upsert } = useSlaConfigRegiaoMutations(clienteId);

  const parseConfig = (row: SlaConfigRegiao | null): Record<string, number> => {
    const prioridades = (row?.config as unknown as SlaConfigJson | undefined)?.prioridades ?? DEFAULT_SLA_CONFIG.prioridades;
    return Object.fromEntries(
      PRIORIDADES.map((p) => [p, prioridades[p]?.horas ?? DEFAULT_SLA_CONFIG.prioridades[p]?.horas ?? 24])
    );
  };

  const [regiaoId, setRegiaoId] = useState(existing?.regiao_id ?? '');
  const [horas, setHoras] = useState<Record<string, number>>(parseConfig(existing));

  const handleSave = () => {
    if (!regiaoId) { toast.error('Selecione uma região.'); return; }

    const config: SlaConfigJson = {
      ...DEFAULT_SLA_CONFIG,
      prioridades: Object.fromEntries(
        PRIORIDADES.map((p) => [
          p,
          { horas: horas[p] ?? 24, criticidade: DEFAULT_SLA_CONFIG.prioridades[p]?.criticidade ?? 'Média' },
        ])
      ),
    };

    upsert.mutate(
      { regiaoId, config: config as unknown as Record<string, unknown> },
      {
        onSuccess: () => { toast.success('Config de região salva.'); onClose(); },
        onError:   (e) => toast.error(e instanceof Error ? e.message : 'Erro ao salvar'),
      }
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{existing ? 'Editar Override de Região' : 'Nova Config por Região'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label className="text-xs">Região</Label>
            <Select value={regiaoId} onValueChange={setRegiaoId} disabled={!!existing}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {regioes.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.regiao}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Horas de SLA por prioridade</p>
          <div className="grid grid-cols-2 gap-3">
            {PRIORIDADES.map((p) => (
              <div key={p} className="space-y-1">
                <Label className="text-xs">{p}</Label>
                <Input
                  type="number"
                  min={1}
                  value={horas[p] ?? 24}
                  onChange={(e) => setHoras((prev) => ({ ...prev, [p]: parseInt(e.target.value) || 24 }))}
                />
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={upsert.isPending}>
            {upsert.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SlaRegioesTab({ clienteId }: Props) {
  const [editing, setEditing] = useState<SlaConfigRegiao | null | 'new'>('init' as never);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<SlaConfigRegiao | null>(null);

  const { data: configs = [], isLoading } = useSlaConfigRegiao(clienteId);
  const { remove } = useSlaConfigRegiaoMutations(clienteId ?? '');

  const { data: regioes = [] } = useQuery({
    queryKey: ['regioes', clienteId],
    queryFn: () => api.regioes.listByCliente(clienteId!),
    enabled: !!clienteId,
    staleTime: 10 * 60 * 1000,
  });

  const openNew = () => { setSelected(null); setDialogOpen(true); };
  const openEdit = (c: SlaConfigRegiao) => { setSelected(c); setDialogOpen(true); };

  const handleRemove = (c: SlaConfigRegiao) => {
    const nome = c.regiao?.regiao ?? c.regiao_id;
    if (!confirm(`Remover override da região "${nome}"? A config cliente-wide voltará a ser usada.`)) return;
    remove.mutate(c.id, {
      onSuccess: () => toast.success('Override removido.'),
      onError:   (e) => toast.error(e instanceof Error ? e.message : 'Erro ao remover'),
    });
  };

  if (!clienteId) return <p className="text-sm text-muted-foreground p-4">Selecione um cliente.</p>;

  return (
    <>
      {dialogOpen && (
        <EditRegiaoDialog
          clienteId={clienteId}
          existing={selected}
          regioes={regioes}
          onClose={() => setDialogOpen(false)}
        />
      )}

      <Card className="rounded-xl border-2 border-cardBorder">
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
          <div>
            <CardTitle className="text-sm">SLA por Região</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Configure horas de SLA diferentes para regiões específicas. Sobrescreve a config cliente-wide.
            </CardDescription>
          </div>
          <Button size="sm" className="gap-1.5 text-xs shrink-0" onClick={openNew}>
            <Plus className="w-3.5 h-3.5" /> Adicionar
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : configs.length === 0 ? (
            <p className="text-center py-8 text-sm text-muted-foreground">
              Nenhum override por região. A config cliente-wide é usada em todas as regiões.
            </p>
          ) : (
            <div className="divide-y">
              {configs.map((c) => {
                const prioridades = (c.config as unknown as SlaConfigJson | undefined)?.prioridades ?? {};
                return (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                    <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{c.regiao?.regiao ?? c.regiao_id}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {PRIORIDADES.filter((p) => prioridades[p]).map((p) => (
                          <Badge key={p} variant="outline" className="text-xs px-1.5 py-0 font-normal">
                            {p}: {prioridades[p]?.horas}h
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleRemove(c)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
