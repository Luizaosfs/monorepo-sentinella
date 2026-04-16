import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { usePagination } from '@/hooks/usePagination';
import TablePagination from '@/components/TablePagination';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, Trash2, Search, Plane, ArrowLeft, Upload, Download, AlertTriangle, Wind, Droplets, ThumbsUp, CloudRain } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCondicoesVoo } from '@/hooks/queries/useCondicoesVoo';
import { api } from '@/services/api';
import { handleQuotaError } from '@/lib/quotaErrorHandler';
import AdminPageHeader from '@/components/AdminPageHeader';
import MobileListCard from '@/components/admin/MobileListCard';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import { getErrorMessage } from '@/lib/utils';
import { Voo, Planejamento } from '@/types/database';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';

const emptyForm = {
  planejamento_id: '',
  voo_numero: '',
  inicio: '',
  fim: '',
  duracao_min: '',
  km: '',
  ha: '',
  baterias: '',
  fotos: '',
  amostra_lat: '',
  amostra_lon: '',
  amostra_data_hora: '',
  amostra_arquivo: '',
  wx_error: '',
  wx_detail: '',
};

const AdminVoos = () => {
  const location = useLocation();
  const { clienteId, tenantStatus } = useClienteAtivo();
  const editVooIdFromState = useRef<string | null>((location.state as { editVooId?: string })?.editVooId || null);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Voo | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);
  const [importing, setImporting] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [pendingImportData, setPendingImportData] = useState<Partial<Voo>[] | null>(null);
  const [fallbackPlanId, setFallbackPlanId] = useState<string>('');

  const { data: condicoes } = useCondicoesVoo(clienteId);

  const { data: planejamentos = [] } = useQuery({
    queryKey: ['admin_voos_planejamentos', clienteId],
    queryFn: () => api.planejamentos.listByCliente(clienteId!),
    enabled: !!clienteId,
    staleTime: 0,
  });

  // Mapa planejamento_id → config_fonte (levantamento mais recente com fallback)
  // Query separada para evitar o problema de ordenação em embedded joins.
  const { data: configFonteMap = {} } = useQuery({
    queryKey: ['admin_voos_config_fonte', clienteId],
    queryFn: () => api.levantamentos.listConfigFonteMap(clienteId!),
    enabled: !!clienteId,
    staleTime: 0,
  });

  const { data: voos = [], isLoading: loading } = useQuery({
    queryKey: ['admin_voos', clienteId],
    queryFn: async () => {
      const data = await api.voos.listByCliente(clienteId!) as (Voo & { planejamento?: Planejamento })[];
      return data.filter(v => v.planejamento?.cliente_id === clienteId || !v.planejamento_id);
    },
    enabled: !!clienteId,
    staleTime: 0,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: { data: Partial<Voo>; id?: string }) => {
      if (payload.id) {
        await api.voos.update(payload.id, payload.data);
      } else {
        await api.voos.create(payload.data as Omit<Voo, 'id' | 'created_at' | 'updated_at'>);
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin_voos', clienteId] });
      setShowForm(false);
      toast.success(variables.id ? 'Voo atualizado' : 'Voo criado');
    },
    onError: (err: unknown) => {
      if (!handleQuotaError(err)) toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.voos.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_voos', clienteId] });
      toast.success('Voo excluído');
    },
    onError: (err: unknown) => {
      if (!handleQuotaError(err)) toast.error(err instanceof Error ? err.message : 'Erro ao excluir');
    },
  });

  // Auto-open edit if navigated with editVooId state
  useEffect(() => {
    const id = editVooIdFromState.current;
    if (id && voos.length > 0 && !showForm) {
      const voo = voos.find(v => v.id === id);
      if (voo) { openEdit(voo); editVooIdFromState.current = null; }
    }
  }, [voos, showForm]); // eslint-disable-line react-hooks/exhaustive-deps



  const openCreate = async () => {
    if (clienteId) {
      try {
        const q = await api.quotas.verificar(clienteId, 'voos_mes');
        if (!q.ok) {
          toast.error(`Quota de voos atingida: ${q.usado}/${q.limite} voos este mês.`);
          return;
        }
        if (q.limite != null && q.usado >= q.limite * 0.8) {
          toast.warning(`Atenção: ${q.usado}/${q.limite} voos utilizados este mês.`);
        }
      } catch { /* quota indisponível — não bloqueia */ }
    }
    setEditing(null);
    setForm({ ...emptyForm });
    setShowForm(true);
  };

  const openEdit = (v: Voo) => {
    setEditing(v);
    setForm({
      planejamento_id: v.planejamento_id || '',
      voo_numero: v.voo_numero?.toString() || '',
      inicio: v.inicio ? v.inicio.slice(0, 16) : '',
      fim: v.fim ? v.fim.slice(0, 16) : '',
      duracao_min: v.duracao_min?.toString() || '',
      km: v.km?.toString() || '',
      ha: v.ha?.toString() || '',
      baterias: v.baterias?.toString() || '',
      fotos: v.fotos?.toString() || '',
      amostra_lat: v.amostra_lat?.toString() || '',
      amostra_lon: v.amostra_lon?.toString() || '',
      amostra_data_hora: v.amostra_data_hora ? v.amostra_data_hora.slice(0, 16) : '',
      amostra_arquivo: v.amostra_arquivo || '',
      wx_error: v.wx_error || '',
      wx_detail: v.wx_detail || '',
    });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.inicio) { toast.error('Data/hora de início é obrigatória'); return; }
    const payload: Partial<Voo> = {
      planejamento_id: form.planejamento_id || null,
      voo_numero: form.voo_numero ? parseInt(form.voo_numero) : null,
      inicio: new Date(form.inicio).toISOString(),
      fim: form.fim ? new Date(form.fim).toISOString() : null,
      duracao_min: form.duracao_min ? parseFloat(form.duracao_min) : null,
      km: form.km ? parseFloat(form.km) : null,
      ha: form.ha ? parseFloat(form.ha) : null,
      baterias: form.baterias ? parseInt(form.baterias) : null,
      fotos: form.fotos ? parseInt(form.fotos) : null,
      amostra_lat: form.amostra_lat ? parseFloat(form.amostra_lat) : null,
      amostra_lon: form.amostra_lon ? parseFloat(form.amostra_lon) : null,
      amostra_data_hora: form.amostra_data_hora ? new Date(form.amostra_data_hora).toISOString() : null,
      amostra_arquivo: form.amostra_arquivo || null,
      wx_error: form.wx_error || null,
      wx_detail: form.wx_detail || null,
    };
    saveMutation.mutate({ data: payload, ...(editing ? { id: editing.id } : {}) });
  };

  const handleDelete = (v: Voo) => {
    setConfirmDialog({
      title: 'Excluir voo',
      description: `Excluir voo #${v.voo_numero || v.id}? Esta ação não pode ser desfeita.`,
      onConfirm: () => deleteMutation.mutate(v.id),
    });
  };

  /* ── IMPORT JSON ── */
  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);

      // Accept array directly or { voos: [...] } or { items: [...] }
      const items: Record<string, unknown>[] = Array.isArray(json)
        ? json
        : (json.voos || json.items || json.dados || []);

      if (!Array.isArray(items) || items.length === 0) throw new Error('Array de voos não encontrado (esperado array raiz ou chave "voos")');
      if (items.length > 500) throw new Error('Máximo de 500 voos por importação');

      const str = (obj: Record<string, unknown>, k: string) => {
        const v = obj[k]; return v != null && v !== '' ? String(v) : null;
      };
      const num = (obj: Record<string, unknown>, k: string) => {
        const v = obj[k]; return v != null && v !== '' ? Number(v) : null;
      };
      const toIso = (obj: Record<string, unknown>, k: string) => {
        const v = obj[k];
        if (!v) return null;
        try { return new Date(String(v)).toISOString(); } catch { return null; }
      };

      // Try to match planejamento by descricao
      const planMap = new Map(planejamentos.map(p => [(p.descricao || '').toLowerCase(), p.id]));

      let needsPlan = false;

      const mapped = items.map((item) => {
        const planDesc = str(item, 'planejamento') || str(item, 'planejamento_descricao');
        const planId = str(item, 'planejamento_id') || (planDesc ? planMap.get(planDesc.toLowerCase()) || null : null);

        if (!planId) needsPlan = true;

        const inicio = toIso(item, 'inicio') || toIso(item, 'data_inicio');
        if (!inicio) throw new Error(`Voo sem campo "inicio" válido: ${JSON.stringify(item).slice(0, 100)}`);

        return {
          planejamento_id: planId,
          voo_numero: num(item, 'voo_numero') ?? num(item, 'numero'),
          inicio,
          fim: toIso(item, 'fim') || toIso(item, 'data_fim'),
          duracao_min: num(item, 'duracao_min') ?? num(item, 'duracao'),
          km: num(item, 'km') ?? num(item, 'distancia_km'),
          ha: num(item, 'ha') ?? num(item, 'area_ha'),
          baterias: num(item, 'baterias'),
          fotos: num(item, 'fotos') ?? num(item, 'total_fotos'),
          amostra_lat: num(item, 'amostra_lat') ?? num(item, 'latitude'),
          amostra_lon: num(item, 'amostra_lon') ?? num(item, 'longitude'),
          amostra_data_hora: toIso(item, 'amostra_data_hora'),
          amostra_arquivo: str(item, 'amostra_arquivo') || str(item, 'arquivo'),
          wx_error: str(item, 'wx_error'),
          wx_detail: str(item, 'wx_detail'),
        };
      });

      if (needsPlan) {
        setPendingImportData(mapped);
        setShowPlanModal(true);
        setImporting(false);
        if (e.target) e.target.value = '';
        return;
      }

      await executeImport(mapped);

    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
      setImporting(false);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const executeImport = async (mapped: Partial<Voo>[]) => {
    setImporting(true);
    try {
      await api.voos.bulkCreate(mapped);

      toast.success(`${mapped.length} voo(s) importado(s) com sucesso`);
      queryClient.invalidateQueries({ queryKey: ['admin_voos', clienteId] });
      setShowPlanModal(false);
      setPendingImportData(null);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setImporting(false);
    }
  };

  const handleConfirmPlanImport = () => {
    if (!fallbackPlanId) {
      toast.error('Selecione um planejamento para os voos órfãos.');
      return;
    }
    if (pendingImportData) {
      const updatedData = pendingImportData.map(v => ({
        ...v,
        planejamento_id: v.planejamento_id || fallbackPlanId
      }));
      executeImport(updatedData);
    }
  };

  const cancelImport = () => {
    setShowPlanModal(false);
    setPendingImportData(null);
    setImporting(false);
  };

  const handleDownloadTemplate = () => {
    const template = [
      {
        "voo_numero": 101,
        "inicio": "2024-05-10T08:00:00Z",
        "fim": "2024-05-10T11:30:00Z",
        "duracao_min": 210,
        "km": 42.5,
        "ha": 120.5,
        "baterias": 4,
        "fotos": 800,
        "amostra_lat": -23.5505,
        "amostra_lon": -46.6333,
        "arquivo": "voo_101.zip",
        "planejamento": "Descrição do Planejamento 1"
      },
      {
        "voo_numero": 102,
        "inicio": "2024-05-11T09:15:00Z",
        "duracao_min": 45,
        "km": 12.0
      }
    ];
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo_importacao_voos.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = voos.filter((v) =>
    (v.planejamento?.descricao || '').toLowerCase().includes(search.toLowerCase()) ||
    (v.amostra_arquivo || '').toLowerCase().includes(search.toLowerCase()) ||
    (v.voo_numero?.toString() || '').includes(search)
  );

  const { page, totalPages, paginated, goTo, next, prev, reset, total } = usePagination(filtered);

  const formatDt = (iso: string | null) => {
    if (!iso) return '—';
    try { return format(new Date(iso), 'dd/MM/yyyy HH:mm', { locale: ptBR }); } catch { return '—'; }
  };

  const set = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  if (showForm) {
    return (
      <div className="space-y-4 animate-fade-in overflow-x-hidden min-w-0 max-w-full">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 shrink-0">
            <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h2 className="text-base sm:text-lg font-semibold">{editing ? 'Editar Voo' : 'Novo Voo'}</h2>
              <p className="text-xs sm:text-sm text-muted-foreground">{editing ? 'Atualize os dados do voo.' : 'Preencha os dados do voo.'}</p>
            </div>
          </div>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending || !!tenantStatus?.isBlocked}>
              {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editing ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </div>

        {/* ── Condições meteorológicas ── */}
        {condicoes && condicoes.nivel_risco !== null && (
          <div className={`flex flex-col sm:flex-row sm:items-start gap-3 rounded-xl border-2 px-4 py-3 text-sm ${
            !condicoes.apto
              ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200'
              : 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200'
          }`}>
            <div className="flex items-center gap-2 shrink-0 pt-0.5">
              {condicoes.apto
                ? <ThumbsUp className="w-4 h-4" />
                : <AlertTriangle className="w-4 h-4" />}
              <span className="font-semibold">
                {condicoes.apto ? 'Condições adequadas para voo' : 'Atenção: condições desfavoráveis'}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              {condicoes.vento_kmh != null && (
                <Badge variant="outline" className="gap-1 text-xs font-normal">
                  <Wind className="w-3 h-3" />
                  {condicoes.vento_kmh.toFixed(0)} km/h
                </Badge>
              )}
              {condicoes.chuva_24h_mm != null && (
                <Badge variant="outline" className="gap-1 text-xs font-normal">
                  <Droplets className="w-3 h-3" />
                  {condicoes.chuva_24h_mm.toFixed(1)} mm/24h
                </Badge>
              )}
              {condicoes.prev_d1_mm != null && condicoes.prev_d1_mm > 0 && (
                <Badge variant="outline" className="gap-1 text-xs font-normal">
                  <CloudRain className="w-3 h-3" />
                  prev. {condicoes.prev_d1_mm.toFixed(1)} mm
                </Badge>
              )}
              {condicoes.temp_c != null && (
                <Badge variant="outline" className="gap-1 text-xs font-normal">
                  {condicoes.temp_c.toFixed(0)}°C
                </Badge>
              )}
            </div>
            {!condicoes.apto && condicoes.motivos.length > 0 && (
              <ul className="w-full mt-1 sm:mt-0 list-disc list-inside space-y-0.5 text-xs opacity-80">
                {condicoes.motivos.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            )}
          </div>
        )}

        <Card className="rounded-sm border-2 border-cardBorder shadow-lg shadow-black/8 dark:shadow-black/20">
          <CardContent className="p-4 xl:p-6 space-y-6">
            <div className="space-y-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Vínculo</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Planejamento</Label>
                  <Select value={form.planejamento_id} onValueChange={(v) => set('planejamento_id', v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {planejamentos.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.descricao || p.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nº do Voo</Label>
                  <Input type="number" value={form.voo_numero} onChange={e => set('voo_numero', e.target.value)} placeholder="Ex: 1" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Tempo e Distância</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Início *</Label>
                  <Input type="datetime-local" value={form.inicio} onChange={e => set('inicio', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Fim</Label>
                  <Input type="datetime-local" value={form.fim} onChange={e => set('fim', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Duração (min)</Label>
                  <Input type="number" step="any" value={form.duracao_min} onChange={e => set('duracao_min', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Distância (km)</Label>
                  <Input type="number" step="any" value={form.km} onChange={e => set('km', e.target.value)} />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Cobertura</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Área (ha)</Label>
                  <Input type="number" step="any" value={form.ha} onChange={e => set('ha', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Baterias</Label>
                  <Input type="number" value={form.baterias} onChange={e => set('baterias', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Fotos</Label>
                  <Input type="number" value={form.fotos} onChange={e => set('fotos', e.target.value)} />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Amostra</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Latitude</Label>
                  <Input type="number" step="any" value={form.amostra_lat} onChange={e => set('amostra_lat', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Longitude</Label>
                  <Input type="number" step="any" value={form.amostra_lon} onChange={e => set('amostra_lon', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Data/Hora</Label>
                  <Input type="datetime-local" value={form.amostra_data_hora} onChange={e => set('amostra_data_hora', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Arquivo</Label>
                  <Input value={form.amostra_arquivo} onChange={e => set('amostra_arquivo', e.target.value)} placeholder="nome_do_arquivo.jpg" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
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
      <AdminPageHeader title="Voos" description="Gerencie os voos realizados vinculados aos planejamentos." icon={Plane} />
      <div className="space-y-3 lg:space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por planejamento, arquivo ou nº..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); reset(); }} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={handleDownloadTemplate}
            >
              <Download className="w-3.5 h-3.5" />
              Modelo JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              disabled={importing}
              onClick={() => document.getElementById('voos-json-import')?.click()}
            >
              {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Importar JSON
            </Button>
            <input id="voos-json-import" type="file" accept=".json" className="hidden" onChange={handleImportJson} />
            <Button onClick={openCreate} className="w-full sm:w-auto gap-2">
              <Plus className="w-4 h-4" /> Novo Voo
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
                {/* Mobile cards */}
                <div className="md:hidden p-3 space-y-3">
                  {paginated.map((v) => (
                    <MobileListCard
                      key={v.id}
                      title={`Voo #${v.voo_numero || '—'}`}
                      fields={[
                        { label: 'Planejamento', value: v.planejamento?.descricao },
                        { label: 'Piloto', value: v.piloto?.nome },
                        { label: 'Início', value: formatDt(v.inicio) },
                        { label: 'Duração', value: v.duracao_min ? `${v.duracao_min} min` : null },
                        { label: 'Área', value: v.ha ? `${v.ha} ha` : null },
                        { label: 'Fotos', value: v.fotos?.toString() },
                      ]}
                      onEdit={() => openEdit(v)}
                      onDelete={() => handleDelete(v)}
                    />
                  ))}
                  {filtered.length === 0 && (
                    <p className="text-center py-12 text-muted-foreground text-sm">Nenhum voo encontrado</p>
                  )}
                </div>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Planejamento</TableHead>
                        <TableHead>Piloto</TableHead>
                        <TableHead>Início</TableHead>
                        <TableHead>Duração</TableHead>
                        <TableHead>km</TableHead>
                        <TableHead>Área (ha)</TableHead>
                        <TableHead>Fotos</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginated.map((v) => (
                        <TableRow key={v.id} className="group cursor-pointer hover:bg-muted/50" onClick={() => openEdit(v)}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-1.5">
                              {v.voo_numero ?? '—'}
                              {(() => {
                                const cf = v.planejamento_id ? configFonteMap[v.planejamento_id] : undefined;
                                return cf && cf !== 'supabase' ? (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Badge variant="outline" className="gap-1 text-amber-600 border-amber-400 px-1 py-0 text-xs cursor-default">
                                          <AlertTriangle className="w-3 h-3" />
                                          config local
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        Pipeline usou configuração local (fallback): {cf}.<br />
                                        Verifique se a config do drone está cadastrada no Supabase.
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ) : null;
                              })()}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{v.planejamento?.descricao || '—'}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{v.piloto?.nome || '—'}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{formatDt(v.inicio)}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{v.duracao_min ? `${v.duracao_min} min` : '—'}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{v.km ?? '—'}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{v.ha ?? '—'}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{v.fotos ?? '—'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(v); }}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(v); }} className="text-destructive hover:text-destructive">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filtered.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                            Nenhum voo encontrado
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

      <Dialog open={showPlanModal} onOpenChange={(open) => !open && cancelImport()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Planejamento Necessário</DialogTitle>
            <DialogDescription>
              Alguns dos voos do seu JSON não especificaram um "planejamento" válido para o sistema.
              Por favor, selecione qual planejamento deseja vincular para os voos órfãos dessa importação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Escolha um Planejamento</Label>
              <Select value={fallbackPlanId} onValueChange={setFallbackPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {planejamentos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.descricao || p.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" onClick={cancelImport}>Cancelar Importação</Button>
            <Button onClick={handleConfirmPlanImport} disabled={importing || !fallbackPlanId}>
              {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminVoos;
