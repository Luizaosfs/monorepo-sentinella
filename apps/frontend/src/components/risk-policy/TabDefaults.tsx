import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { SentinelaRiskDefaults } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props { policyId: string; }

export const TabDefaults = ({ policyId }: Props) => {
  const [data, setData] = useState<SentinelaRiskDefaults | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ chuva_relevante_mm: 0, dias_lookup_max: 0, tendencia_dias: 0 });

  useEffect(() => {
    api.riskPolicyEditor.getDefaults(policyId).then((d) => {
      if (d) { setData(d); setForm({ chuva_relevante_mm: d.chuva_relevante_mm, dias_lookup_max: d.dias_lookup_max, tendencia_dias: d.tendencia_dias }); }
      setLoading(false);
    });
  }, [policyId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await api.riskPolicyEditor.upsertDefaults(policyId, form, data?.id);
      setData(result);
      toast.success('Defaults salvos');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Parâmetros Padrão</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Chuva Relevante (mm)</Label>
          <Input type="number" step="0.01" value={form.chuva_relevante_mm} onChange={e => setForm(f => ({ ...f, chuva_relevante_mm: +e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Dias Lookup Máx</Label>
          <Input type="number" value={form.dias_lookup_max} onChange={e => setForm(f => ({ ...f, dias_lookup_max: +e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Tendência (dias)</Label>
          <Input type="number" value={form.tendencia_dias} onChange={e => setForm(f => ({ ...f, tendencia_dias: +e.target.value }))} />
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />} Salvar
        </Button>
      </div>
    </div>
  );
};
