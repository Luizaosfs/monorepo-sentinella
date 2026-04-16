import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface BinRow { id?: string; idx: number; min_val: number; max_val: number; }
interface Props { policyId: string; }

const BIN_TABLES = [
  { key: 'sentinela_risk_bin_sem_chuva', label: 'Dias Sem Chuva', unit: 'dias', isInt: true },
  { key: 'sentinela_risk_bin_intensidade_chuva', label: 'Intensidade de Chuva', unit: 'mm', isInt: false },
  { key: 'sentinela_risk_bin_persistencia_7d', label: 'Persistência 7d', unit: 'dias', isInt: true },
] as const;

export const TabBins = ({ policyId }: Props) => {
  const [bins, setBins] = useState<Record<string, BinRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const result: Record<string, BinRow[]> = {};
      for (const t of BIN_TABLES) {
        result[t.key] = await api.riskPolicyEditor.listBins(t.key, policyId);
      }
      setBins(result);
      setLoading(false);
    };
    load();
  }, [policyId]);

  const addRow = (tableKey: string) => {
    const rows = bins[tableKey] || [];
    const nextIdx = rows.length > 0 ? Math.max(...rows.map(r => r.idx)) + 1 : 0;
    setBins(prev => ({ ...prev, [tableKey]: [...rows, { idx: nextIdx, min_val: 0, max_val: 0 }] }));
  };

  const removeRow = (tableKey: string, index: number) => {
    setBins(prev => ({ ...prev, [tableKey]: prev[tableKey].filter((_, i) => i !== index) }));
  };

  const updateRow = (tableKey: string, index: number, field: keyof BinRow, value: number) => {
    setBins(prev => ({
      ...prev,
      [tableKey]: prev[tableKey].map((r, i) => i === index ? { ...r, [field]: value } : r),
    }));
  };

  const handleSave = async (tableKey: string) => {
    setSaving(tableKey);
    try {
      await api.riskPolicyEditor.replaceBins(tableKey, policyId, bins[tableKey] || []);
      toast.success('Faixas salvas');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    }
    setSaving(null);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      {BIN_TABLES.map((t, tIdx) => (
        <div key={t.key}>
          {tIdx > 0 && <Separator className="mb-6" />}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t.label}</p>
              <Button size="sm" variant="outline" onClick={() => addRow(t.key)}>
                <Plus className="h-3 w-3 mr-1" /> Faixa
              </Button>
            </div>
            {(bins[t.key]?.length || 0) > 0 ? (
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-16">#</TableHead>
                      <TableHead>Mín ({t.unit})</TableHead>
                      <TableHead>Máx ({t.unit})</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bins[t.key].map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground font-mono text-xs">{i}</TableCell>
                        <TableCell>
                          <Input type="number" step={t.isInt ? 1 : 0.01} value={row.min_val}
                            onChange={e => updateRow(t.key, i, 'min_val', +e.target.value)} className="h-8" />
                        </TableCell>
                        <TableCell>
                          <Input type="number" step={t.isInt ? 1 : 0.01} value={row.max_val}
                            onChange={e => updateRow(t.key, i, 'max_val', +e.target.value)} className="h-8" />
                        </TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" onClick={() => removeRow(t.key, i)} className="h-7 w-7">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma faixa. Clique em "+ Faixa".</p>
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
