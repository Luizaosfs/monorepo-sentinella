import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { http } from '@sentinella/api-client';
import { api } from '@/services/api';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { usePagination } from '@/hooks/usePagination';
import TablePagination from '@/components/TablePagination';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, Trash2, Search, ArrowLeft, CloudRain, Upload, Download, Zap } from 'lucide-react';
import { PluvioRisco, Regiao } from '@/types/database';
import AdminPageHeader from '@/components/AdminPageHeader';
import MobileListCard from '@/components/admin/MobileListCard';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import { getErrorMessage } from '@/lib/utils';
import { seedDefaultRiskPolicy } from '@/lib/seedDefaultRiskPolicy';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const emptyForm = {
  regiao_id: '',
  dt_ref: '',
  chuva_24h: '',
  chuva_72h: '',
  chuva_7d: '',
  dias_pos_chuva: '',
  janela_sem_chuva: '',
  persistencia_7d: '',
  tendencia: '',
  situacao_ambiental: '',
  prob_label: '',
  prob_base_min: '',
  prob_base_max: '',
  prob_final_min: '',
  prob_final_max: '',
  classificacao_final: '',
  temp_c: '',
  vento_kmh: '',
  temp_med_c: '',
  vento_med_kmh: '',
  prev_d1_mm: '',
  prev_d2_mm: '',
  prev_d3_mm: '',
};

const classificacaoColor: Record<string, string> = {
  Baixo: 'text-green-600',
  Moderado: 'text-yellow-600',
  Alto: 'text-orange-600',
  'Muito Alto': 'text-red-600',
  Critico: 'text-red-800',
};

function prevColor(mm: number | null | undefined): string {
  if (mm == null) return '';
  if (mm < 5) return 'text-green-600 dark:text-green-400';
  if (mm < 20) return 'text-yellow-600 dark:text-yellow-400';
  if (mm < 50) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

const AdminPluvioRisco = () => {
  const { isAdmin } = useAuth();
  const { clienteId } = useClienteAtivo();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PluvioRisco | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [importing, setImporting] = useState(false);
  const [runningJob, setRunningJob] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);

  const { data: regioes = [] } = useQuery({
    queryKey: ['admin_regioes', clienteId],
    queryFn: () => api.regioes.listByCliente(clienteId!),
    enabled: !!clienteId,
    staleTime: 0,
  });

  const regIds = regioes.map((r) => r.id);

  const { data: rows = [], isLoading: loading } = useQuery({
    queryKey: ['admin_pluvio_risco', clienteId],
    queryFn: () => api.pluvioRisco.listByRegioes(regIds) as Promise<(PluvioRisco & { regiao?: Regiao })[]>,
    enabled: regIds.length > 0,
    staleTime: 0,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: typeof emptyForm & { id?: string }) => {
      const { id, ...data } = payload;
      const record = {
        regiao_id: data.regiao_id,
        dt_ref: data.dt_ref,
        chuva_24h: numOrNull(data.chuva_24h),
        chuva_72h: numOrNull(data.chuva_72h),
        chuva_7d: numOrNull(data.chuva_7d),
        dias_pos_chuva: intOrNull(data.dias_pos_chuva),
        janela_sem_chuva: data.janela_sem_chuva || null,
        persistencia_7d: intOrNull(data.persistencia_7d),
        tendencia: data.tendencia || null,
        situacao_ambiental: data.situacao_ambiental || null,
        prob_label: data.prob_label || null,
        prob_base_min: numOrNull(data.prob_base_min),
        prob_base_max: numOrNull(data.prob_base_max),
        prob_final_min: numOrNull(data.prob_final_min),
        prob_final_max: numOrNull(data.prob_final_max),
        classificacao_final: data.classificacao_final || null,
        temp_c: numOrNull(data.temp_c),
        vento_kmh: numOrNull(data.vento_kmh),
        temp_med_c: numOrNull(data.temp_med_c),
        vento_med_kmh: numOrNull(data.vento_med_kmh),
        prev_d1_mm: numOrNull(data.prev_d1_mm),
        prev_d2_mm: numOrNull(data.prev_d2_mm),
        prev_d3_mm: numOrNull(data.prev_d3_mm),
        updated_at: new Date().toISOString(),
      };
      await api.pluvioRisco.upsert(id ?? null, record);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_pluvio_risco', clienteId] });
      setShowForm(false);
      toast.success(editing ? 'Registro atualizado' : 'Registro cadastrado');
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Erro ao salvar'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.pluvioRisco.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_pluvio_risco', clienteId] });
      toast.success('Registro excluído');
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Erro ao excluir'),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (r: PluvioRisco) => {
    setEditing(r);
    setForm({
      regiao_id: r.regiao_id,
      dt_ref: r.dt_ref,
      chuva_24h: r.chuva_24h?.toString() ?? '',
      chuva_72h: r.chuva_72h?.toString() ?? '',
      chuva_7d: r.chuva_7d?.toString() ?? '',
      dias_pos_chuva: r.dias_pos_chuva?.toString() ?? '',
      janela_sem_chuva: r.janela_sem_chuva ?? '',
      persistencia_7d: r.persistencia_7d?.toString() ?? '',
      tendencia: r.tendencia ?? '',
      situacao_ambiental: r.situacao_ambiental ?? '',
      prob_label: r.prob_label ?? '',
      prob_base_min: r.prob_base_min?.toString() ?? '',
      prob_base_max: r.prob_base_max?.toString() ?? '',
      prob_final_min: r.prob_final_min?.toString() ?? '',
      prob_final_max: r.prob_final_max?.toString() ?? '',
      classificacao_final: r.classificacao_final ?? '',
      temp_c: r.temp_c?.toString() ?? '',
      vento_kmh: r.vento_kmh?.toString() ?? '',
      temp_med_c: r.temp_med_c?.toString() ?? '',
      vento_med_kmh: r.vento_med_kmh?.toString() ?? '',
      prev_d1_mm: r.prev_d1_mm?.toString() ?? '',
      prev_d2_mm: r.prev_d2_mm?.toString() ?? '',
      prev_d3_mm: r.prev_d3_mm?.toString() ?? '',
    });
    setShowForm(true);
  };

  const numOrNull = (v: string) => (v === '' ? null : parseFloat(v));
  const intOrNull = (v: string) => (v === '' ? null : parseInt(v, 10));

  const handleSave = () => {
    if (!form.regiao_id) { toast.error('Selecione uma região'); return; }
    if (!form.dt_ref) { toast.error('Data de referência é obrigatória'); return; }
    saveMutation.mutate({ ...form, ...(editing ? { id: editing.id } : {}) });
  };

  const handleDelete = (r: PluvioRisco & { regiao?: Regiao }) => {
    const label = `${r.regiao?.regiao ?? 'Região'} — ${r.dt_ref}`;
    setConfirmDialog({
      title: 'Excluir registro',
      description: `Excluir o registro "${label}"? Esta ação não pode ser desfeita.`,
      onConfirm: () => deleteMutation.mutate(r.id),
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

      // Accept array directly or { items/dados/registros: [...] }
      const items: Record<string, unknown>[] = Array.isArray(json)
        ? json
        : (json.items || json.dados || json.registros || json.pluvio_risco || []);

      if (!Array.isArray(items) || items.length === 0) throw new Error('Array de registros não encontrado');
      if (items.length > 500) throw new Error('Máximo de 500 registros por importação');

      const str = (obj: Record<string, unknown>, k: string) => {
        const v = obj[k]; return v != null && v !== '' ? String(v) : null;
      };
      const num = (obj: Record<string, unknown>, k: string) => {
        const v = obj[k]; return v != null && v !== '' ? Number(v) : null;
      };
      const intVal = (obj: Record<string, unknown>, k: string) => {
        const v = obj[k]; return v != null && v !== '' ? parseInt(String(v), 10) : null;
      };

      // Build region name → id map (mutable — new regions added on the fly)
      const regMap = new Map(regioes.map(r => [r.regiao.toLowerCase(), r.id]));
      let newRegionsCount = 0;

      const mapped = [];
      for (const item of items) {
        // Match regiao by name or id
        let regiaoId = str(item, 'regiao_id');
        if (!regiaoId) {
          const nome = str(item, 'regiao') || str(item, 'regiao_nome') || str(item, 'bairro') || str(item, 'bairro_nome');
          if (nome) {
            regiaoId = regMap.get(nome.toLowerCase()) || null;
            // Auto-create region if not found
            if (!regiaoId && clienteId) {
              try {
                regiaoId = await api.regioes.create({
                  regiao: nome.trim(),
                  cliente_id: clienteId,
                  latitude: null,
                  longitude: null,
                  area: null,
                });
                regMap.set(nome.toLowerCase(), regiaoId);
                newRegionsCount++;
              } catch (regErr: unknown) {
                const msg = regErr instanceof Error ? regErr.message : String(regErr);
                if (msg.includes('row-level security') || msg.includes('42501')) {
                  throw new Error(`A região "${nome}" não existe e seu usuário não tem permissão para criá-la automaticamente. Solicite o cadastro prévio a um administrador.`);
                }
                throw new Error(`Erro ao criar região "${nome}": ${msg}`);
              }
            }
          }
        }
        if (!regiaoId) throw new Error(`Região não encontrada para item: ${JSON.stringify(item).slice(0, 100)}`);

        const dtRef = str(item, 'dt_ref') || str(item, 'data_referencia');
        if (!dtRef) throw new Error(`Campo "dt_ref" ausente em: ${JSON.stringify(item).slice(0, 100)}`);

        mapped.push({
          regiao_id: regiaoId,
          dt_ref: dtRef,
          chuva_24h: num(item, 'chuva_24h') ?? num(item, 'chuva_24h_mm'),
          chuva_72h: num(item, 'chuva_72h') ?? num(item, 'chuva_72h_mm'),
          chuva_7d: num(item, 'chuva_7d') ?? num(item, 'chuva_7d_mm'),
          dias_pos_chuva: intVal(item, 'dias_pos_chuva'),
          janela_sem_chuva: str(item, 'janela_sem_chuva'),
          persistencia_7d: intVal(item, 'persistencia_7d'),
          tendencia: str(item, 'tendencia'),
          situacao_ambiental: str(item, 'situacao_ambiental'),
          prob_label: str(item, 'prob_label'),
          prob_base_min: num(item, 'prob_base_min'),
          prob_base_max: num(item, 'prob_base_max'),
          prob_final_min: num(item, 'prob_final_min'),
          prob_final_max: num(item, 'prob_final_max'),
          classificacao_final: str(item, 'classificacao_final') || str(item, 'classificacao'),
          temp_c: num(item, 'temp_c') ?? num(item, 'temp_media_c'),
          vento_kmh: num(item, 'vento_kmh') ?? num(item, 'vento_medio_kmh'),
          temp_med_c: num(item, 'temp_med_c') ?? num(item, 'temp_media_c'),
          vento_med_kmh: num(item, 'vento_med_kmh') ?? num(item, 'vento_medio_kmh'),
          updated_at: new Date().toISOString(),
        });
      }

      await api.pluvioRisco.bulkInsert(mapped);

      const msg = newRegionsCount > 0
        ? `${mapped.length} registro(s) importado(s) + ${newRegionsCount} região(ões) criada(s)`
        : `${mapped.length} registro(s) importado(s) com sucesso`;
      toast.success(msg);
      queryClient.invalidateQueries({ queryKey: ['admin_pluvio_risco', clienteId] });
      queryClient.invalidateQueries({ queryKey: ['admin_regioes', clienteId] });
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleDownloadTemplate = () => {
    const template = [
      {
        regiao: "Centro",
        dt_ref: "2024-03-20",
        chuva_24h: 15.5,
        chuva_72h: 45.2,
        chuva_7d: 120.0,
        dias_pos_chuva: 2,
        janela_sem_chuva: "Não",
        persistencia_7d: 5,
        tendencia: "crescente",
        situacao_ambiental: "Estável",
        prob_label: "Alta",
        prob_base_min: 60,
        prob_base_max: 80,
        prob_final_min: 65,
        prob_final_max: 85,
        classificacao_final: "Alto",
        temp_c: 28.5,
        vento_kmh: 12,
        temp_med_c: 26,
        vento_med_kmh: 10
      }
    ];
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo_importacao_risco.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRunJob = () => {
    setConfirmDialog({
      title: 'Executar job meteorológico',
      description: 'Executar o job pluvio-risco-daily agora? Isso buscará dados meteorológicos para todas as regiões com coordenadas.',
      onConfirm: async () => {
        setRunningJob(true);
        try {
          let data = await http.post('/jobs/pluvio-risco-daily', {}) as Record<string, unknown>;
          if (!data?.ok) {
            throw new Error(String(data?.error ?? 'Erro desconhecido'));
          }

          // Auto-seed clientes sem policy e retentar
          const semPolicy: string[] = ((data.errors as string[] | undefined) ?? [])
            .filter((e: string) => String(e).includes('sem policy ativa'))
            .map((e: string) => e.replace(/^Cliente\s+/, '').replace(/:\s*sem policy ativa$/, '').trim());

          if (semPolicy.length > 0) {
            toast.info(`Inicializando policy padrão para ${semPolicy.length} cliente(s)...`);
            await Promise.all(semPolicy.map((id) => seedDefaultRiskPolicy(id)));
            // Retentar o job após seed
            const retry = await http.post('/jobs/pluvio-risco-daily', {}).catch(() => null) as Record<string, unknown> | null;
            if (retry?.ok) {
              data = retry;
            }
          }

          const parts = [`${data.inserted} registro(s) inserido(s)`];
          if (data.skipped > 0) parts.push(`${data.skipped} já existente(s)`);
          const remainingErrors = (data.errors ?? []).filter(
            (e: string) => !String(e).includes('sem policy ativa')
          );
          if (remainingErrors.length) parts.push(`${remainingErrors.length} erro(s)`);
          toast.success(`Job concluído — ${parts.join(', ')}`, { duration: 6000 });
          if (remainingErrors.length) {
            const firstError = String(remainingErrors[0] ?? '').trim();
            if (firstError) toast.error(`Primeiro erro: ${firstError}`, { duration: 9000 });
            console.warn('[pluvio-risco-daily] Erros:', remainingErrors);
          }
          queryClient.invalidateQueries({ queryKey: ['admin_pluvio_risco', clienteId] });
        } catch (err: unknown) {
          toast.error(`Erro ao executar job: ${err instanceof Error ? err.message : 'desconhecido'}`);
        } finally {
          setRunningJob(false);
        }
      },
    });
  };

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase();
    return (
      (r.regiao?.regiao ?? '').toLowerCase().includes(q) ||
      r.dt_ref.includes(q) ||
      (r.classificacao_final ?? '').toLowerCase().includes(q)
    );
  });

  const { page, totalPages, paginated, goTo, next, prev, reset, total } = usePagination(filtered);

  const setField = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }));

  /* ===== FORM ===== */
  if (showForm) {
    return (
    <div className="space-y-4 lg:space-y-4 animate-fade-in overflow-x-hidden min-w-0 max-w-full">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setShowForm(false)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold">{editing ? 'Editar Registro' : 'Novo Registro'}</h2>
            <p className="text-sm text-muted-foreground">
              {editing ? 'Atualize os dados pluviométricos.' : 'Preencha os dados do risco pluviométrico.'}
            </p>
          </div>
        </div>

        <Card className="rounded-sm border-2 border-cardBorder shadow-lg shadow-black/8 dark:shadow-black/20">
          <CardContent className="p-6">
            <div className="grid gap-4">
              {/* Região + Data */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Região *</Label>
                  <Select value={form.regiao_id} onValueChange={(v) => setField('regiao_id', v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {regioes.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.regiao}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Data Referência *</Label>
                  <Input type="date" value={form.dt_ref} onChange={(e) => setField('dt_ref', e.target.value)} />
                </div>
              </div>

              {/* Chuva */}
              <h3 className="text-sm font-medium text-muted-foreground mt-2">Precipitação</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Chuva 24h (mm)</Label>
                  <Input type="number" step="any" value={form.chuva_24h} onChange={(e) => setField('chuva_24h', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Chuva 72h (mm)</Label>
                  <Input type="number" step="any" value={form.chuva_72h} onChange={(e) => setField('chuva_72h', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Chuva 7d (mm)</Label>
                  <Input type="number" step="any" value={form.chuva_7d} onChange={(e) => setField('chuva_7d', e.target.value)} />
                </div>
              </div>

              {/* Métricas derivadas */}
              <h3 className="text-sm font-medium text-muted-foreground mt-2">Métricas</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Dias pós chuva</Label>
                  <Input type="number" value={form.dias_pos_chuva} onChange={(e) => setField('dias_pos_chuva', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Janela sem chuva</Label>
                  <Input value={form.janela_sem_chuva} onChange={(e) => setField('janela_sem_chuva', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Persistência 7d</Label>
                  <Input type="number" value={form.persistencia_7d} onChange={(e) => setField('persistencia_7d', e.target.value)} />
                </div>
              </div>

              {/* Classificação */}
              <h3 className="text-sm font-medium text-muted-foreground mt-2">Classificação</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Tendência</Label>
                  <Select value={form.tendencia} onValueChange={(v) => setField('tendencia', v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="crescente">Crescente</SelectItem>
                      <SelectItem value="estavel">Estável</SelectItem>
                      <SelectItem value="decrescente">Decrescente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Situação Ambiental</Label>
                  <Input value={form.situacao_ambiental} onChange={(e) => setField('situacao_ambiental', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Classificação Final</Label>
                  <Input value={form.classificacao_final} onChange={(e) => setField('classificacao_final', e.target.value)} />
                </div>
              </div>

              {/* Probabilidades */}
              <h3 className="text-sm font-medium text-muted-foreground mt-2">Probabilidade</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Label</Label>
                  <Input value={form.prob_label} onChange={(e) => setField('prob_label', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Base Mín (%)</Label>
                  <Input type="number" step="any" value={form.prob_base_min} onChange={(e) => setField('prob_base_min', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Base Máx (%)</Label>
                  <Input type="number" step="any" value={form.prob_base_max} onChange={(e) => setField('prob_base_max', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Final Mín (%)</Label>
                  <Input type="number" step="any" value={form.prob_final_min} onChange={(e) => setField('prob_final_min', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Final Máx (%)</Label>
                  <Input type="number" step="any" value={form.prob_final_max} onChange={(e) => setField('prob_final_max', e.target.value)} />
                </div>
              </div>

              {/* Clima */}
              <h3 className="text-sm font-medium text-muted-foreground mt-2">Clima</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Temp (°C)</Label>
                  <Input type="number" step="any" value={form.temp_c} onChange={(e) => setField('temp_c', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Vento (km/h)</Label>
                  <Input type="number" step="any" value={form.vento_kmh} onChange={(e) => setField('vento_kmh', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Temp Média (°C)</Label>
                  <Input type="number" step="any" value={form.temp_med_c} onChange={(e) => setField('temp_med_c', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Vento Médio (km/h)</Label>
                  <Input type="number" step="any" value={form.vento_med_kmh} onChange={(e) => setField('vento_med_kmh', e.target.value)} />
                </div>
              </div>

              {/* Previsão */}
              <h3 className="text-sm font-medium text-muted-foreground mt-2">Previsão (próximos dias)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Prev D+1 (mm)</Label>
                  <Input type="number" step="any" value={form.prev_d1_mm} onChange={(e) => setField('prev_d1_mm', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Prev D+2 (mm)</Label>
                  <Input type="number" step="any" value={form.prev_d2_mm} onChange={(e) => setField('prev_d2_mm', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Prev D+3 (mm)</Label>
                  <Input type="number" step="any" value={form.prev_d3_mm} onChange={(e) => setField('prev_d3_mm', e.target.value)} />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {editing ? 'Salvar' : 'Cadastrar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ===== LIST ===== */
  return (
    <div className="space-y-4 lg:space-y-4 overflow-x-hidden min-w-0 max-w-full">
      <ConfirmDialog
        open={!!confirmDialog}
        onOpenChange={(open) => { if (!open) setConfirmDialog(null); }}
        title={confirmDialog?.title ?? ''}
        description={confirmDialog?.description ?? ''}
        onConfirm={() => { confirmDialog?.onConfirm(); setConfirmDialog(null); }}
      />
      <AdminPageHeader
        title="Risco Pluviométrico"
        description="Dados de risco pluviométrico por região."
        icon={CloudRain}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por região, data ou classificação..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); reset(); }}
          />
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
            onClick={() => document.getElementById('pluvio-risco-json-import')?.click()}
          >
            {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Importar JSON
          </Button>
          <input id="pluvio-risco-json-import" type="file" accept=".json" className="hidden" onChange={handleImportJson} />
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            disabled={runningJob}
            onClick={handleRunJob}
          >
            {runningJob ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            {runningJob ? 'Executando...' : 'Rodar Job'}
          </Button>
          <Button onClick={openCreate} className="w-full sm:w-auto gap-2">
            <Plus className="w-4 h-4" />
            Novo Registro
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
                {paginated.map((r) => (
                  <MobileListCard
                    key={r.id}
                    title={`${r.regiao?.regiao ?? '—'} — ${r.dt_ref}`}
                    fields={[
                      { label: 'Chuva 24h', value: `${r.chuva_24h ?? 0} mm` },
                      { label: 'Classificação', value: r.classificacao_final ?? '—' },
                      { label: 'Prob. Final', value: `${r.prob_final_min ?? '?'}–${r.prob_final_max ?? '?'}%` },
                      { label: 'Prev D+1/D+2/D+3', value: `${r.prev_d1_mm ?? '—'} / ${r.prev_d2_mm ?? '—'} / ${r.prev_d3_mm ?? '—'} mm` },
                    ]}
                    onEdit={() => openEdit(r)}
                    onDelete={isAdmin ? () => handleDelete(r) : undefined}
                  />
                ))}
                {filtered.length === 0 && (
                  <p className="text-center py-12 text-muted-foreground text-sm">Nenhum registro encontrado</p>
                )}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Região</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">24h</TableHead>
                      <TableHead className="text-right">72h</TableHead>
                      <TableHead className="text-right">7d</TableHead>
                      <TableHead>Tendência</TableHead>
                      <TableHead>Classificação</TableHead>
                      <TableHead className="text-right">Prob. Final</TableHead>
                      <TableHead className="text-right">Prev D+1</TableHead>
                      <TableHead className="text-right">Prev D+2</TableHead>
                      <TableHead className="text-right">Prev D+3</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((r) => (
                      <TableRow key={r.id} className="group cursor-pointer hover:bg-muted/50" onClick={() => openEdit(r)}>
                        <TableCell className="font-medium">{r.regiao?.regiao ?? '—'}</TableCell>
                        <TableCell>{r.dt_ref}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.chuva_24h ?? 0}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.chuva_72h ?? 0}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.chuva_7d ?? 0}</TableCell>
                        <TableCell className="capitalize">{r.tendencia ?? '—'}</TableCell>
                        <TableCell>
                          <span className={classificacaoColor[r.classificacao_final ?? ''] ?? ''}>
                            {r.classificacao_final ?? '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.prob_final_min ?? '?'}–{r.prob_final_max ?? '?'}%
                        </TableCell>
                        <TableCell className={`text-right tabular-nums font-medium ${prevColor(r.prev_d1_mm)}`}>{r.prev_d1_mm ?? '—'}</TableCell>
                        <TableCell className={`text-right tabular-nums font-medium ${prevColor(r.prev_d2_mm)}`}>{r.prev_d2_mm ?? '—'}</TableCell>
                        <TableCell className={`text-right tabular-nums font-medium ${prevColor(r.prev_d3_mm)}`}>{r.prev_d3_mm ?? '—'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(r); }}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => { e.stopPropagation(); handleDelete(r); }}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center py-12 text-muted-foreground">
                          Nenhum registro encontrado
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
  );
};

export default AdminPluvioRisco;
