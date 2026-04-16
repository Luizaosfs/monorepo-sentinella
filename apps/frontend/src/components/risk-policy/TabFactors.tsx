import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface FactorRow { id?: string; idx: number; min_val: number; max_val: number; factor: number; }
interface Props { policyId: string; }

const FACTOR_TABLES = [
  { key: 'sentinela_risk_temp_factor', label: 'Fator Temperatura', minField: 'temp_min', maxField: 'temp_max', unit: '°C' },
  { key: 'sentinela_risk_vento_factor', label: 'Fator Vento', minField: 'vento_min', maxField: 'vento_max', unit: 'km/h' },
] as const;

export const TabFactors = ({ policyId }: Props) => {
  const [factors, setFactors] = useState<Record<string, FactorRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const result: Record<string, FactorRow[]> = {};
      for (const t of FACTOR_TABLES) {
        result[t.key] = await api.riskPolicyEditor.listFactors(t.key, policyId, t.minField, t.maxField);
      }
      setFactors(result);
      setLoading(false);
    };
    load();
  }, [policyId]);

  const addRow = (key: string) => {
    const rows = factors[key] || [];
    const nextIdx = rows.length > 0 ? Math.max(...rows.map(r => r.idx)) + 1 : 0;
    setFactors(prev => ({ ...prev, [key]: [...rows, { idx: nextIdx, min_val: 0, max_val: 0, factor: 1 }] }));
  };

  const removeRow = (key: string, i: number) => {
    setFactors(prev => ({ ...prev, [key]: prev[key].filter((_, idx) => idx !== i) }));
  };

  const updateRow = (key: string, i: number, field: keyof FactorRow, value: number) => {
    setFactors(prev => ({ ...prev, [key]: prev[key].map((r, idx) => idx === i ? { ...r, [field]: value } : r) }));
  };

  const handleSave = async (tableKey: string) => {
    const t = FACTOR_TABLES.find(x => x.key === tableKey)!;
    setSaving(tableKey);
    try {
      await api.riskPolicyEditor.replaceFactors(tableKey, policyId, t.minField, t.maxField, factors[tableKey] || []);
      toast.success('Fatores salvos');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    }
    setSaving(null);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      {FACTOR_TABLES.map((t, tIdx) => (
        <div key={t.key}>
          {tIdx > 0 && <Separator className="mb-6" />}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t.label}</p>
              <Button size="sm" variant="outline" onClick={() => addRow(t.key)}><Plus className="h-3 w-3 mr-1" /> Faixa</Button>
            </div>
            {(factors[t.key]?.length || 0) > 0 ? (
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Mín ({t.unit})</TableHead>
                      <TableHead>Máx ({t.unit})</TableHead>
                      <TableHead>Fator</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {factors[t.key].map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground font-mono text-xs">{i}</TableCell>
                        <TableCell><Input type="number" step="0.01" value={r.min_val} onChange={e => updateRow(t.key, i, 'min_val', +e.target.value)} className="h-8" /></TableCell>
                        <TableCell><Input type="number" step="0.01" value={r.max_val} onChange={e => updateRow(t.key, i, 'max_val', +e.target.value)} className="h-8" /></TableCell>
                        <TableCell><Input type="number" step="0.0001" value={r.factor} onChange={e => updateRow(t.key, i, 'factor', +e.target.value)} className="h-8" /></TableCell>
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
    </div>
  );
};
