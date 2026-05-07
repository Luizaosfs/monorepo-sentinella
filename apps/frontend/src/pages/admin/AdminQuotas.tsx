import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { useClienteQuotasAll, useClienteQuotasMutation } from '@/hooks/queries/useClienteQuotas';
import AdminPageHeader from '@/components/AdminPageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Loader2, Gauge, Pencil, AlertTriangle, CheckCircle2,
  Infinity as InfinityIcon, ArrowLeft, Plane, ClipboardList,
  List, Users, Eye, Sparkles, HardDrive, Save, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { ClienteUsoMensal } from '@/types/database';

// ── Usage bar (multi-client grid) ────────────────────────────────────────────
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

// ── Edit dialog (multi-client grid) ──────────────────────────────────────────
function EditQuotaDialog({ row, onClose }: { row: ClienteUsoMensal; onClose: () => void }) {
  const mutation = useClienteQuotasMutation(row.cliente_id);
  const [form, setForm] = useState({
    voos_mes:          row.voos_mes_limite?.toString() ?? '',
    levantamentos_mes: row.levantamentos_mes_limite?.toString() ?? '',
    itens_mes:         row.itens_mes_limite?.toString() ?? '',
    usuarios_ativos:   row.usuarios_ativos_limite?.toString() ?? '',
    vistorias_mes:     row.vistorias_mes_limite?.toString() ?? '',
    ia_calls_mes:      row.ia_calls_mes_limite?.toString() ?? '',
    storage_gb:        row.storage_gb_limite?.toString() ?? '',
  });
  const parse    = (v: string) => v.trim() === '' ? null : parseInt(v, 10) || null;
  const parseNum = (v: string) => v.trim() === '' ? null : parseFloat(v) || null;
  const handleSave = () => mutation.mutate(
    { voos_mes: parse(form.voos_mes), levantamentos_mes: parse(form.levantamentos_mes), itens_mes: parse(form.itens_mes), usuarios_ativos: parse(form.usuarios_ativos), vistorias_mes: parse(form.vistorias_mes), ia_calls_mes: parse(form.ia_calls_mes), storage_gb: parseNum(form.storage_gb) },
    { onSuccess: () => { toast.success('Quotas atualizadas'); onClose(); }, onError: (e) => toast.error(e instanceof Error ? e.message : 'Erro ao salvar') }
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Quotas — {row.cliente_nome}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">Deixe em branco para ilimitado.</p>
        <div className="space-y-4 py-2">
          {([
            { key: 'voos_mes',          label: 'Voos / mês',          step: '1'   },
            { key: 'levantamentos_mes', label: 'Levantamentos / mês', step: '1'   },
            { key: 'itens_mes',         label: 'Itens / mês',         step: '1'   },
            { key: 'usuarios_ativos',   label: 'Usuários ativos',     step: '1'   },
            { key: 'vistorias_mes',     label: 'Vistorias / mês',     step: '1'   },
            { key: 'ia_calls_mes',      label: 'Triagens IA / mês',   step: '1'   },
            { key: 'storage_gb',        label: 'Storage (GB)',        step: '0.1' },
          ] as const).map(({ key, label, step }) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs">{label}</Label>
              <Input type="number" min={0} step={step} value={form[key]} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))} placeholder="Ilimitado" />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Single-client detailed view ───────────────────────────────────────────────
type FormKey = 'voos_mes' | 'levantamentos_mes' | 'itens_mes' | 'usuarios_ativos' | 'vistorias_mes' | 'ia_calls_mes' | 'storage_gb';

interface MetricDef {
  key: FormKey;
  label: string;
  Icon: LucideIcon;
  usado: number;
  limite: number | null;
  excedido: boolean;
  step: string;
  isFloat: boolean;
}

function buildMetrics(row: ClienteUsoMensal): MetricDef[] {
  const n = (v: number | null | undefined) => v ?? 0;
  return [
    { key: 'voos_mes',          label: 'Voos / mês',          Icon: Plane,         usado: n(row.voos_mes_usado),          limite: row.voos_mes_limite          ?? null, excedido: !!row.voos_excedido,          step: '1',   isFloat: false },
    { key: 'levantamentos_mes', label: 'Levantamentos / mês', Icon: ClipboardList, usado: n(row.levantamentos_mes_usado), limite: row.levantamentos_mes_limite ?? null, excedido: !!row.levantamentos_excedido, step: '1',   isFloat: false },
    { key: 'itens_mes',         label: 'Itens / mês',         Icon: List,          usado: n(row.itens_mes_usado),         limite: row.itens_mes_limite         ?? null, excedido: !!row.itens_excedido,         step: '1',   isFloat: false },
    { key: 'usuarios_ativos',   label: 'Usuários ativos',     Icon: Users,         usado: n(row.usuarios_ativos_usado),   limite: row.usuarios_ativos_limite   ?? null, excedido: !!row.usuarios_excedido,      step: '1',   isFloat: false },
    { key: 'vistorias_mes',     label: 'Vistorias / mês',     Icon: Eye,           usado: n(row.vistorias_mes_usado),     limite: row.vistorias_mes_limite     ?? null, excedido: !!row.vistorias_excedido,     step: '1',   isFloat: false },
    { key: 'ia_calls_mes',      label: 'Triagens IA / mês',   Icon: Sparkles,      usado: n(row.ia_calls_mes_usado),      limite: row.ia_calls_mes_limite      ?? null, excedido: !!row.ia_calls_excedido,      step: '1',   isFloat: false },
    { key: 'storage_gb',        label: 'Storage (GB)',        Icon: HardDrive,     usado: n(row.storage_gb_usado),        limite: row.storage_gb_limite        ?? null, excedido: row.storage_gb_limite != null && n(row.storage_gb_usado) >= row.storage_gb_limite, step: '0.1', isFloat: true },
  ];
}

function SingleClientQuotas({ row, onBack }: { row: ClienteUsoMensal; onBack: () => void }) {
  const mutation = useClienteQuotasMutation(row.cliente_id);
  const [editMode, setEditMode] = useState(false);
  const initialForm = () => ({
    voos_mes:          row.voos_mes_limite?.toString() ?? '',
    levantamentos_mes: row.levantamentos_mes_limite?.toString() ?? '',
    itens_mes:         row.itens_mes_limite?.toString() ?? '',
    usuarios_ativos:   row.usuarios_ativos_limite?.toString() ?? '',
    vistorias_mes:     row.vistorias_mes_limite?.toString() ?? '',
    ia_calls_mes:      row.ia_calls_mes_limite?.toString() ?? '',
    storage_gb:        row.storage_gb_limite?.toString() ?? '',
  });
  const [form, setForm] = useState(initialForm);

  const parse    = (v: string) => v.trim() === '' ? null : parseInt(v, 10) || null;
  const parseNum = (v: string) => v.trim() === '' ? null : parseFloat(v) || null;

  const handleSave = () => mutation.mutate(
    { voos_mes: parse(form.voos_mes), levantamentos_mes: parse(form.levantamentos_mes), itens_mes: parse(form.itens_mes), usuarios_ativos: parse(form.usuarios_ativos), vistorias_mes: parse(form.vistorias_mes), ia_calls_mes: parse(form.ia_calls_mes), storage_gb: parseNum(form.storage_gb) },
    { onSuccess: () => { toast.success('Quotas atualizadas'); setEditMode(false); }, onError: (e) => toast.error(e instanceof Error ? e.message : 'Erro ao salvar') }
  );

  const handleCancel = () => { setForm(initialForm()); setEditMode(false); };

  const metrics = buildMetrics(row);
  const exceededCount     = metrics.filter(m => m.excedido).length;
  const withLimit         = metrics.filter(m => m.limite != null);
  const unlimitedCount    = metrics.length - withLimit.length;
  const avgUsage = withLimit.length > 0
    ? Math.round(withLimit.reduce((acc, m) => acc + Math.min(100, (m.usado / m.limite!) * 100), 0) / withLimit.length)
    : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold truncate">{row.cliente_nome}</h2>
            {exceededCount > 0 ? (
              <Badge variant="destructive" className="gap-1 shrink-0">
                <AlertTriangle className="w-3 h-3" /> {exceededCount} excedida{exceededCount > 1 ? 's' : ''}
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1 text-emerald-600 shrink-0">
                <CheckCircle2 className="w-3 h-3" /> Dentro do limite
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Quotas de uso — mês corrente</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {editMode ? (
            <>
              <Button variant="outline" size="sm" onClick={handleCancel} disabled={mutation.isPending}>
                <X className="w-3.5 h-3.5 mr-1.5" /> Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={mutation.isPending}>
                {mutation.isPending
                  ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  : <Save className="w-3.5 h-3.5 mr-1.5" />}
                Salvar
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
              <Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar Limites
            </Button>
          )}
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="rounded-sm border border-cardBorder">
          <CardContent className="p-3 text-center">
            <p className={`text-2xl font-bold ${exceededCount > 0 ? 'text-destructive' : 'text-foreground'}`}>{exceededCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Excedida{exceededCount !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>
        <Card className="rounded-sm border border-cardBorder">
          <CardContent className="p-3 text-center">
            <p className={`text-2xl font-bold ${avgUsage != null && avgUsage > 80 ? 'text-amber-600' : 'text-foreground'}`}>
              {avgUsage != null ? `${avgUsage}%` : '—'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Uso médio</p>
          </CardContent>
        </Card>
        <Card className="rounded-sm border border-cardBorder">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{unlimitedCount}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Sem limite</p>
          </CardContent>
        </Card>
      </div>

      {/* Métricas */}
      <Card className="rounded-sm border-2 border-cardBorder shadow-sm">
        <CardContent className="p-0 divide-y divide-border">
          {metrics.map(({ key, label, Icon, usado, limite, excedido, step, isFloat }) => {
            const pct = limite == null ? 0 : Math.min(100, Math.round((usado / limite) * 100));
            const barColor = excedido ? 'bg-destructive' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500';
            return (
              <div key={key} className={`flex items-center gap-3 px-4 py-3 transition-colors ${excedido ? 'bg-destructive/5' : ''}`}>
                {/* Icon + label */}
                <div className="flex items-center gap-2.5 w-48 shrink-0">
                  <Icon className={`w-4 h-4 shrink-0 ${excedido ? 'text-destructive' : 'text-muted-foreground'}`} />
                  <span className={`text-sm truncate ${excedido ? 'text-destructive font-medium' : ''}`}>{label}</span>
                </div>

                {/* Bar */}
                <div className="flex-1 min-w-0">
                  {limite != null ? (
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                  ) : (
                    <div className="h-2 w-full rounded-full bg-muted/30" />
                  )}
                </div>

                {/* Numbers */}
                <div className="text-xs text-right w-32 shrink-0 tabular-nums">
                  <span className={excedido ? 'text-destructive font-semibold' : 'text-muted-foreground'}>
                    {isFloat ? usado.toFixed(1) : usado}
                    {' / '}
                    {limite == null
                      ? <span className="inline-flex items-center"><InfinityIcon className="w-3 h-3 inline" /></span>
                      : (isFloat ? limite.toFixed(1) : limite)}
                  </span>
                  {limite != null && (
                    <span className={`ml-1.5 font-semibold ${excedido ? 'text-destructive' : pct > 80 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {pct}%
                    </span>
                  )}
                </div>

                {/* Inline edit input */}
                {editMode ? (
                  <div className="w-28 shrink-0">
                    <Input
                      type="number"
                      min={0}
                      step={step}
                      value={form[key]}
                      onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                      placeholder="Ilimitado"
                      className="h-8 text-xs"
                    />
                  </div>
                ) : (
                  excedido
                    ? <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                    : <div className="w-4 shrink-0" />
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminQuotas() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const filterClienteId = searchParams.get('clienteId');

  const { data: rawRows, isLoading } = useClienteQuotasAll();
  const allRows = rawRows ?? [];
  const rows = filterClienteId ? allRows.filter((r) => r.cliente_id === filterClienteId) : allRows;
  const [editing, setEditing] = useState<ClienteUsoMensal | null>(null);

  const anyExceeded = (r: ClienteUsoMensal) =>
    r.voos_excedido || r.levantamentos_excedido || r.itens_excedido ||
    r.usuarios_excedido || r.vistorias_excedido || r.ia_calls_excedido;

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Filtered single-client view ──────────────────────────────────────────
  if (filterClienteId) {
    const clienteRow = allRows.find((r) => r.cliente_id === filterClienteId);
    if (!clienteRow) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin/clientes')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <p className="text-sm text-muted-foreground">Cliente não encontrado ou sem dados de uso.</p>
          </div>
        </div>
      );
    }
    return <SingleClientQuotas row={clienteRow} onBack={() => navigate('/admin/clientes')} />;
  }

  // ── All-clients grid view ────────────────────────────────────────────────
  return (
    <div className="space-y-4 overflow-x-hidden min-w-0 max-w-full">
      {editing && <EditQuotaDialog row={editing} onClose={() => setEditing(null)} />}

      <AdminPageHeader
        title="Quotas de Uso"
        description="Gerencie limites de uso mensais por cliente. Clique no lápis para editar."
        icon={Gauge}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {rows.map((r) => (
          <Card
            key={r.cliente_id}
            className={`rounded-sm border-2 shadow-sm ${anyExceeded(r) ? 'border-destructive/60' : 'border-cardBorder'}`}
          >
            <div className="pb-2 flex flex-row items-start justify-between gap-2 p-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{r.cliente_nome}</p>
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
            </div>
            <CardContent className="space-y-3 pt-0">
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
    </div>
  );
}
