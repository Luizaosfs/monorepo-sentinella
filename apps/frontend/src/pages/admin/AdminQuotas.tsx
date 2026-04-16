import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { useClienteQuotasAll, useClienteQuotasMutation } from '@/hooks/queries/useClienteQuotas';
import AdminPageHeader from '@/components/AdminPageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Gauge, Pencil, AlertTriangle, CheckCircle2, Infinity as InfinityIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ClienteUsoMensal } from '@/types/database';
import { api } from '@/services/api';

// ── Usage bar ────────────────────────────────────────────────────────────────
function UsageBar({ usado, limite, label }: { usado: number; limite: number | null; label: string }) {
  const pct = limite == null ? 0 : Math.min(100, Math.round((usado / limite) * 100));
  const exceeded = limite != null && usado >= limite;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className={exceeded ? 'text-destructive font-semibold' : ''}>
          {usado} / {limite == null ? <InfinityIcon className="w-3 h-3 inline" /> : limite}
        </span>
      </div>
      {limite != null ? (
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${exceeded ? 'bg-destructive' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : (
        <div className="h-1.5 w-full rounded-full bg-muted/40" />
      )}
    </div>
  );
}

// ── Edit dialog ───────────────────────────────────────────────────────────────
function EditQuotaDialog({
  row,
  onClose,
}: {
  row: ClienteUsoMensal;
  onClose: () => void;
}) {
  const mutation = useClienteQuotasMutation(row.cliente_id);
  const [form, setForm] = useState({
    voos_mes:           row.voos_mes_limite?.toString() ?? '',
    levantamentos_mes:  row.levantamentos_mes_limite?.toString() ?? '',
    itens_mes:          row.itens_mes_limite?.toString() ?? '',
    usuarios_ativos:    row.usuarios_ativos_limite?.toString() ?? '',
    vistorias_mes:      row.vistorias_mes_limite?.toString() ?? '',
    ia_calls_mes:       row.ia_calls_mes_limite?.toString() ?? '',
    storage_gb:         row.storage_gb_limite?.toString() ?? '',
  });

  const parse = (v: string) => v.trim() === '' ? null : parseInt(v, 10) || null;
  const parseNum = (v: string) => v.trim() === '' ? null : parseFloat(v) || null;

  const handleSave = () => {
    mutation.mutate(
      {
        voos_mes:          parse(form.voos_mes),
        levantamentos_mes: parse(form.levantamentos_mes),
        itens_mes:         parse(form.itens_mes),
        usuarios_ativos:   parse(form.usuarios_ativos),
        vistorias_mes:     parse(form.vistorias_mes),
        ia_calls_mes:      parse(form.ia_calls_mes),
        storage_gb:        parseNum(form.storage_gb),
      },
      {
        onSuccess: () => { toast.success('Quotas atualizadas'); onClose(); },
        onError:   (e) => toast.error(e instanceof Error ? e.message : 'Erro ao salvar'),
      }
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Quotas — {row.cliente_nome}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">Deixe em branco para ilimitado.</p>
        <div className="space-y-4 py-2">
          {([
            { key: 'voos_mes',          label: 'Voos / mês',           step: '1' },
            { key: 'levantamentos_mes', label: 'Levantamentos / mês',  step: '1' },
            { key: 'itens_mes',         label: 'Itens / mês',          step: '1' },
            { key: 'usuarios_ativos',   label: 'Usuários ativos',      step: '1' },
            { key: 'vistorias_mes',     label: 'Vistorias / mês',      step: '1' },
            { key: 'ia_calls_mes',      label: 'Triagens IA / mês',    step: '1' },
            { key: 'storage_gb',        label: 'Storage (GB)',         step: '0.1' },
          ] as const).map(({ key, label, step }) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              <Input
                type="number"
                min={0}
                step={step}
                value={form[key]}
                onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                placeholder="Ilimitado"
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminQuotas() {
  const { data: rows = [], isLoading } = useClienteQuotasAll();
  const [editing, setEditing] = useState<ClienteUsoMensal | null>(null);

  const anyExceeded = (r: ClienteUsoMensal) =>
    r.voos_excedido || r.levantamentos_excedido || r.itens_excedido || r.usuarios_excedido ||
    r.vistorias_excedido || r.ia_calls_excedido;

  return (
    <div className="space-y-4 lg:space-y-4 overflow-x-hidden min-w-0 max-w-full">
      {editing && <EditQuotaDialog row={editing} onClose={() => setEditing(null)} />}

      <AdminPageHeader
        title="Quotas de Uso"
        description="Gerencie limites de uso mensais por cliente. Deixe em branco para ilimitado."
        icon={Gauge}
      />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {rows.map((r) => (
            <Card
              key={r.cliente_id}
              className={`rounded-sm border-2 shadow-sm ${anyExceeded(r) ? 'border-destructive/60' : 'border-cardBorder'}`}
            >
              <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="text-sm font-semibold truncate">{r.cliente_nome}</CardTitle>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {anyExceeded(r) ? (
                    <Badge variant="destructive" className="gap-1 text-xs">
                      <AlertTriangle className="w-3 h-3" /> Excedido
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1 text-xs text-emerald-600">
                      <CheckCircle2 className="w-3 h-3" /> OK
                    </Badge>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(r)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <UsageBar usado={r.voos_mes_usado}          limite={r.voos_mes_limite}          label="Voos / mês" />
                <UsageBar usado={r.levantamentos_mes_usado} limite={r.levantamentos_mes_limite} label="Levantamentos / mês" />
                <UsageBar usado={r.itens_mes_usado}         limite={r.itens_mes_limite}         label="Itens / mês" />
                <UsageBar usado={r.usuarios_ativos_usado}   limite={r.usuarios_ativos_limite}   label="Usuários ativos" />
                <UsageBar usado={r.vistorias_mes_usado}     limite={r.vistorias_mes_limite}     label="Vistorias / mês" />
                <UsageBar usado={r.ia_calls_mes_usado}      limite={r.ia_calls_mes_limite}      label="Triagens IA / mês" />
                <UsageBar usado={r.storage_gb_usado}        limite={r.storage_gb_limite}        label="Storage (GB)" />
              </CardContent>
            </Card>
          ))}
          {rows.length === 0 && (
            <p className="col-span-full text-center py-12 text-muted-foreground text-sm">
              Nenhum cliente encontrado.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
