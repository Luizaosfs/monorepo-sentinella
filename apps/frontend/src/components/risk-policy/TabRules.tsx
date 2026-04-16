import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import { SentinelaRiskRule, SentinelaRiskFallbackRule } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props { policyId: string; }

type RuleRow = Omit<SentinelaRiskRule, 'id' | 'policy_id' | 'created_at'> & { id?: string };
type FallbackRow = Omit<SentinelaRiskFallbackRule, 'id' | 'policy_id' | 'created_at'> & { id?: string };

const emptyRule = (): RuleRow => ({
  idx: 0, chuva_mm_min: 0, chuva_mm_max: 0, dias_min: 0, dias_max: 0,
  situacao_ambiental: '', probabilidade_label: '', probabilidade_pct_min: 0,
  probabilidade_pct_max: 0, classificacao: '', icone: '', severity: 0,
});

export const TabRules = ({ policyId }: Props) => {
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [fallback, setFallback] = useState<FallbackRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingRules, setSavingRules] = useState(false);
  const [savingFallback, setSavingFallback] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [rulesData, fbData] = await Promise.all([
        api.riskPolicyEditor.listRules(policyId),
        api.riskPolicyEditor.getFallbackRule(policyId),
      ]);
      setRules(rulesData.map(r => ({ ...r })));
      setFallback(fbData || null);
      setLoading(false);
    };
    load();
  }, [policyId]);

  const addRule = () => {
    const nextIdx = rules.length > 0 ? Math.max(...rules.map(r => r.idx)) + 1 : 0;
    setRules(prev => [...prev, { ...emptyRule(), idx: nextIdx }]);
  };

  const removeRule = (i: number) => setRules(prev => prev.filter((_, idx) => idx !== i));

  const updateRule = <K extends keyof RuleRow>(i: number, field: K, value: RuleRow[K]) => {
    setRules(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  };

  const handleSaveRules = async () => {
    setSavingRules(true);
    try {
      await api.riskPolicyEditor.replaceRules(policyId, rules.map(({ id, ...rest }) => rest));
      toast.success('Regras salvas');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar regras');
    }
    setSavingRules(false);
  };

  const handleSaveFallback = async () => {
    if (!fallback) return;
    setSavingFallback(true);
    try {
      const { id, ...rest } = fallback;
      const newId = await api.riskPolicyEditor.upsertFallbackRule(policyId, rest, id);
      setFallback(f => f && ({ ...f, id: newId }));
      toast.success('Fallback salvo');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar fallback');
    }
    setSavingFallback(false);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      {/* Main rules */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Regras (Chuva × Dias)</p>
          <Button size="sm" variant="outline" onClick={addRule}><Plus className="h-3 w-3 mr-1" /> Regra</Button>
        </div>
        {rules.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Chuva Mín</TableHead>
                  <TableHead>Chuva Máx</TableHead>
                  <TableHead>Dias Mín</TableHead>
                  <TableHead>Dias Máx</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Prob. Label</TableHead>
                  <TableHead>% Mín</TableHead>
                  <TableHead>% Máx</TableHead>
                  <TableHead>Classif.</TableHead>
                  <TableHead>Ícone</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-muted-foreground font-mono text-xs">{i}</TableCell>
                    {(['chuva_mm_min','chuva_mm_max','dias_min','dias_max'] as const).map(f => (
                      <TableCell key={f}>
                        <Input type="number" step="0.01" value={r[f]} onChange={e => updateRule(i, f, +e.target.value)} className="h-8 w-20" />
                      </TableCell>
                    ))}
                    {(['situacao_ambiental','probabilidade_label'] as const).map(f => (
                      <TableCell key={f}>
                        <Input value={r[f]} onChange={e => updateRule(i, f, e.target.value)} className="h-8 w-28" />
                      </TableCell>
                    ))}
                    {(['probabilidade_pct_min','probabilidade_pct_max'] as const).map(f => (
                      <TableCell key={f}>
                        <Input type="number" value={r[f]} onChange={e => updateRule(i, f, +e.target.value)} className="h-8 w-16" />
                      </TableCell>
                    ))}
                    <TableCell><Input value={r.classificacao} onChange={e => updateRule(i, 'classificacao', e.target.value)} className="h-8 w-24" /></TableCell>
                    <TableCell><Input value={r.icone} onChange={e => updateRule(i, 'icone', e.target.value)} className="h-8 w-16" /></TableCell>
                    <TableCell><Input type="number" value={r.severity} onChange={e => updateRule(i, 'severity', +e.target.value)} className="h-8 w-16" /></TableCell>
                    <TableCell><Button size="icon" variant="ghost" onClick={() => removeRule(i)} className="h-7 w-7"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma regra. Clique em "+ Regra".</p>
        )}
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSaveRules} disabled={savingRules}>
            {savingRules ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />} Salvar Regras
          </Button>
        </div>
      </div>

      <Separator />

      {/* Fallback rule */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Regra Fallback</p>
        {!fallback ? (
          <div className="text-center py-4">
            <Button size="sm" variant="outline" onClick={() => setFallback({
              situacao_ambiental: '', probabilidade_label: '', probabilidade_pct_min: 0,
              probabilidade_pct_max: 0, classificacao: '', icone: '', severity: 0,
            })}>
              <Plus className="h-3 w-3 mr-1" /> Criar Fallback
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Situação</Label><Input value={fallback.situacao_ambiental} onChange={e => setFallback(f => f && ({ ...f, situacao_ambiental: e.target.value }))} className="h-8" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Prob. Label</Label><Input value={fallback.probabilidade_label} onChange={e => setFallback(f => f && ({ ...f, probabilidade_label: e.target.value }))} className="h-8" /></div>
              <div className="space-y-1.5"><Label className="text-xs">% Mín</Label><Input type="number" value={fallback.probabilidade_pct_min} onChange={e => setFallback(f => f && ({ ...f, probabilidade_pct_min: +e.target.value }))} className="h-8" /></div>
              <div className="space-y-1.5"><Label className="text-xs">% Máx</Label><Input type="number" value={fallback.probabilidade_pct_max} onChange={e => setFallback(f => f && ({ ...f, probabilidade_pct_max: +e.target.value }))} className="h-8" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Classificação</Label><Input value={fallback.classificacao} onChange={e => setFallback(f => f && ({ ...f, classificacao: e.target.value }))} className="h-8" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Ícone</Label><Input value={fallback.icone} onChange={e => setFallback(f => f && ({ ...f, icone: e.target.value }))} className="h-8" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Severity</Label><Input type="number" value={fallback.severity} onChange={e => setFallback(f => f && ({ ...f, severity: +e.target.value }))} className="h-8" /></div>
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={handleSaveFallback} disabled={savingFallback}>
                {savingFallback ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />} Salvar Fallback
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
