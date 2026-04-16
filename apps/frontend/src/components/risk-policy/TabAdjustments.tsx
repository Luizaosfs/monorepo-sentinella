import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { TendenciaTipo } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface AdjustRow { id?: string; idx: number; min_val: number; max_val: number; delta_pp: number; }
interface TendenciaRow { id?: string; tendencia: TendenciaTipo; delta_pp: number; }
interface Props { policyId: string; }

const ADJUST_TABLES = [
  { key: 'sentinela_risk_temp_adjust_pp', label: 'Ajuste Temperatura (PP)', minField: 'temp_min', maxField: 'temp_max', unit: '°C' },
  { key: 'sentinela_risk_vento_adjust_pp', label: 'Ajuste Vento (PP)', minField: 'vento_min', maxField: 'vento_max', unit: 'km/h' },
  { key: 'sentinela_risk_persistencia_adjust_pp', label: 'Ajuste Persistência (PP)', minField: 'dias_min', maxField: 'dias_max', unit: 'dias' },
] as const;

const TENDENCIAS: TendenciaTipo[] = ['crescente', 'estavel', 'decrescente'];

export const TabAdjustments = ({ policyId }: Props) => {
  const [adjusts, setAdjusts] = useState<Record<string, AdjustRow[]>>({});
  const [tendencias, setTendencias] = useState<TendenciaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const result: Record<string, AdjustRow[]> = {};
      for (const t of ADJUST_TABLES) {
        result[t.key] = await api.riskPolicyEditor.listAdjusts(t.key, policyId, t.minField, t.maxField);
      }
      const tendData = await api.riskPolicyEditor.listTendenciaAdjusts(policyId);
      setAdjusts(result);
      setTendencias(tendData);
      setLoading(false);
    };
    load();
  }, [policyId]);

  const addRow = (key: string) => {
    const rows = adjusts[key] || [];
    const nextIdx = rows.length > 0 ? Math.max(...rows.map(r => r.idx)) + 1 : 0;
    setAdjusts(prev => ({ ...prev, [key]: [...rows, { idx: nextIdx, min_val: 0, max_val: 0, delta_pp: 0 }] }));
  };

  const removeRow = (key: string, i: number) => {
    setAdjusts(prev => ({ ...prev, [key]: prev[key].filter((_, idx) => idx !== i) }));
  };

  const updateRow = (key: string, i: number, field: keyof AdjustRow, value: number) => {
    setAdjusts(prev => ({ ...prev, [key]: prev[key].map((r, idx) => idx === i ? { ...r, [field]: value } : r) }));
  };

  const handleSave = async (tableKey: string) => {
    const t = ADJUST_TABLES.find(x => x.key === tableKey)!;
    setSaving(tableKey);
    try {
      await api.riskPolicyEditor.replaceAdjusts(tableKey, policyId, t.minField, t.maxField, adjusts[tableKey] || []);
      toast.success('Ajustes salvos');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    }
    setSaving(null);
  };

  const addTendencia = () => {
    const used = tendencias.map(t => t.tendencia);
    const next = TENDENCIAS.find(t => !used.includes(t));
    if (!next) { toast.info('Todas as tendências já adicionadas'); return; }
    setTendencias(prev => [...prev, { tendencia: next, delta_pp: 0 }]);
  };

  const removeTendencia = (i: number) => setTendencias(prev => prev.filter((_, idx) => idx !== i));

  const handleSaveTendencias = async () => {
    setSaving('tendencia');
    try {
      await api.riskPolicyEditor.replaceTendenciaAdjusts(policyId, tendencias);
      toast.success('Tendências salvas');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    }
    setSaving(null);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      {ADJUST_TABLES.map((t, tIdx) => (
        <div key={t.key}>
          {tIdx > 0 && <Separator className="mb-6" />}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t.label}</p>
              <Button size="sm" variant="outline" onClick={() => addRow(t.key)}><Plus className="h-3 w-3 mr-1" /> Faixa</Button>
            </div>
            {(adjusts[t.key]?.length || 0) > 0 ? (
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Mín ({t.unit})</TableHead>
                      <TableHead>Máx ({t.unit})</TableHead>
                      <TableHead>Delta PP</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adjusts[t.key].map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground font-mono text-xs">{i}</TableCell>
                        <TableCell><Input type="number" step="0.01" value={r.min_val} onChange={e => updateRow(t.key, i, 'min_val', +e.target.value)} className="h-8" /></TableCell>
                        <TableCell><Input type="number" step="0.01" value={r.max_val} onChange={e => updateRow(t.key, i, 'max_val', +e.target.value)} className="h-8" /></TableCell>
                        <TableCell><Input type="number" value={r.delta_pp} onChange={e => updateRow(t.key, i, 'delta_pp', +e.target.value)} className="h-8" /></TableCell>
                        <TableCell><Button size="icon" variant="ghost" onClick={() => removeRow(t.key, i)} className="h-7 w-7"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma faixa.</p>
            )}
            <div className="flex justify-end">
              <Button size="sm" onClick={() => handleSave(t.key)} disabled={saving === t.key}>
                {saving === t.key ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />} Salvar
              </Button>
            </div>
          </div>
        </div>
      ))}

      <Separator />

      {/* Tendência */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Ajuste Tendência (PP)</p>
          <Button size="sm" variant="outline" onClick={addTendencia} disabled={tendencias.length >= 3}>
            <Plus className="h-3 w-3 mr-1" /> Tendência
          </Button>
        </div>
        {tendencias.length > 0 ? (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Tendência</TableHead>
                  <TableHead>Delta PP</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tendencias.map((t, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Select value={t.tendencia} onValueChange={v => setTendencias(prev => prev.map((r, idx) => idx === i ? { ...r, tendencia: v as TendenciaTipo } : r))}>
                        <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TENDENCIAS.map(opt => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Input type="number" value={t.delta_pp} onChange={e => setTendencias(prev => prev.map((r, idx) => idx === i ? { ...r, delta_pp: +e.target.value } : r))} className="h-8" /></TableCell>
                    <TableCell><Button size="icon" variant="ghost" onClick={() => removeTendencia(i)} className="h-7 w-7"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tendência.</p>
        )}
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSaveTendencias} disabled={saving === 'tendencia'}>
            {saving === 'tendencia' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />} Salvar
          </Button>
        </div>
      </div>
    </div>
  );
};
