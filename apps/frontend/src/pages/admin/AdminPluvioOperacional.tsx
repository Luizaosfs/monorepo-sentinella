import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
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
import {
  Loader2, Plus, Pencil, Trash2, Search, ArrowLeft, FileSpreadsheet, Eye, ChevronDown, ChevronUp, Upload, Download,
} from 'lucide-react';
import { PluvioOperacionalRun, PluvioOperacionalItem, Regiao } from '@/types/database';
import AdminPageHeader from '@/components/AdminPageHeader';
import MobileListCard from '@/components/admin/MobileListCard';
import ConfirmDialog from '@/components/admin/ConfirmDialog';
import { getErrorMessage } from '@/lib/utils';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

/* ──── helpers ──── */
const numOrNull = (v: string) => (v === '' ? null : parseFloat(v));
const intOrNull = (v: string) => (v === '' ? null : parseInt(v, 10));

const classificacaoColor: Record<string, string> = {
  Baixo: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  Moderado: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  Alto: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  'Muito Alto': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  Crítico: 'bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-200',
};

const emptyItemForm = {
  bairro_nome: '',
  regiao_id: '',
  classificacao_risco: '',
  situacao_ambiental: '',
  chuva_24h_mm: '',
  chuva_72h_mm: '',
  chuva_7d_mm: '',
  dias_com_chuva_7d: '',
  janela_sem_chuva: '',
  persistencia_7d: '',
  tendencia: '',
  temp_media_c: '',
  vento_medio_kmh: '',
  prob_label: '',
  prob_base_min: '',
  prob_base_max: '',
  prob_final_min: '',
  prob_final_max: '',
  criadouro_ativo: '',
  velocidade_ciclo: '',
  janela_emergencia_dias: '',
  prioridade_operacional: '',
  prazo_acao: '',
};

/* ════════════════════════════════════════════════════════════════════════ */
const AdminPluvioOperacional = () => {
  const { isAdmin } = useAuth();
  const { clienteId } = useClienteAtivo();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  // View state
  const [viewMode, setViewMode] = useState<'list' | 'detail' | 'newRun' | 'editItem'>('list');
  const [selectedRun, setSelectedRun] = useState<PluvioOperacionalRun | null>(null);

  // Run form
  const [runForm, setRunForm] = useState({ dt_ref: '' });
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);

  // Item form
  const [editingItem, setEditingItem] = useState<PluvioOperacionalItem | null>(null);
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [importing, setImporting] = useState(false);

  // Flow states for JSON Import
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importDtRefValue, setImportDtRefValue] = useState('');

  const [showRegiaoModal, setShowRegiaoModal] = useState(false);
  const [fallbackRegiaoId, setFallbackRegiaoId] = useState<string>('');

  const [pendingParsedItems, setPendingParsedItems] = useState<Partial<PluvioOperacionalItem>[] | null>(null);
  const [pendingNeedsRegiao, setPendingNeedsRegiao] = useState(false);
  const [pendingDtRef, setPendingDtRef] = useState<string>('');

  // Expanded items on mobile
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  /* ── Queries ── */
  const { data: runsData, isLoading: loading } = useQuery({
    queryKey: ['admin_pluvio_operacional_runs', clienteId],
    queryFn: async () => {
      const [runs, regioes] = await Promise.all([
        api.pluvioOperacional.listRuns(clienteId ?? undefined),
        clienteId ? api.regioes.listByCliente(clienteId) : Promise.resolve([]),
      ]);
      return { runs: runs as PluvioOperacionalRun[], regioes: regioes as Regiao[] };
    },
    staleTime: 0,
  });

  const runs = runsData?.runs ?? [];
  const regioes = runsData?.regioes ?? [];

  const { data: runItems = [], isLoading: loadingItems } = useQuery({
    queryKey: ['admin_pluvio_operacional_items', selectedRun?.id],
    queryFn: async () => {
      if (!selectedRun) return [];
      return api.pluvioOperacional.listItems(selectedRun.id) as Promise<PluvioOperacionalItem[]>;
    },
    enabled: !!selectedRun?.id,
    staleTime: 0,
  });

  /* ── Mutations ── */
  const createRunMutation = useMutation({
    mutationFn: async () => {
      if (!clienteId) throw new Error('Selecione um cliente');
      await api.pluvioOperacional.createRun({ cliente_id: clienteId, dt_ref: runForm.dt_ref, total_bairros: 0 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_pluvio_operacional_runs', clienteId] });
      setViewMode('list');
      toast.success('Run criada');
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Erro ao criar run'),
  });

  const deleteRunMutation = useMutation({
    mutationFn: (runId: string) => api.pluvioOperacional.deleteRun(runId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_pluvio_operacional_runs', clienteId] });
      toast.success('Run excluída');
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Erro ao excluir'),
  });

  const saveItemMutation = useMutation({
    mutationFn: async ({ itemData, editId }: { itemData: typeof emptyItemForm; editId: string | null }) => {
      if (!selectedRun) throw new Error('Nenhum run selecionado');
      const payload = {
        run_id: selectedRun.id,
        bairro_nome: itemData.bairro_nome,
        regiao_id: itemData.regiao_id || null,
        classificacao_risco: itemData.classificacao_risco,
        situacao_ambiental: itemData.situacao_ambiental || null,
        chuva_24h_mm: numOrNull(itemData.chuva_24h_mm),
        chuva_72h_mm: numOrNull(itemData.chuva_72h_mm),
        chuva_7d_mm: numOrNull(itemData.chuva_7d_mm),
        dias_com_chuva_7d: intOrNull(itemData.dias_com_chuva_7d),
        janela_sem_chuva: itemData.janela_sem_chuva || null,
        persistencia_7d: itemData.persistencia_7d || null,
        tendencia: itemData.tendencia || null,
        temp_media_c: numOrNull(itemData.temp_media_c),
        vento_medio_kmh: numOrNull(itemData.vento_medio_kmh),
        prob_label: itemData.prob_label || null,
        prob_base_min: numOrNull(itemData.prob_base_min),
        prob_base_max: numOrNull(itemData.prob_base_max),
        prob_final_min: numOrNull(itemData.prob_final_min),
        prob_final_max: numOrNull(itemData.prob_final_max),
        criadouro_ativo: itemData.criadouro_ativo || null,
        velocidade_ciclo: itemData.velocidade_ciclo || null,
        janela_emergencia_dias: itemData.janela_emergencia_dias || null,
        prioridade_operacional: itemData.prioridade_operacional,
        prazo_acao: itemData.prazo_acao || null,
      };
      await api.pluvioOperacional.upsertItem(editId, payload);
      await api.pluvioOperacional.updateRunTotal(selectedRun.id);
    },
    onSuccess: (_, { editId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin_pluvio_operacional_items', selectedRun?.id] });
      queryClient.invalidateQueries({ queryKey: ['admin_pluvio_operacional_runs', clienteId] });
      setViewMode('detail');
      toast.success(editId ? 'Item atualizado' : 'Item cadastrado');
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Erro ao salvar item'),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      await api.pluvioOperacional.deleteItem(itemId);
      if (selectedRun) await api.pluvioOperacional.updateRunTotal(selectedRun.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_pluvio_operacional_items', selectedRun?.id] });
      queryClient.invalidateQueries({ queryKey: ['admin_pluvio_operacional_runs', clienteId] });
      toast.success('Item excluído');
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : 'Erro ao excluir'),
  });

  /* ── CRUD: create run ── */
  const handleCreateRun = () => {
    if (!runForm.dt_ref) { toast.error('Data de referência obrigatória'); return; }
    if (!clienteId) { toast.error('Selecione um cliente'); return; }
    createRunMutation.mutate();
  };

  /* ── CRUD: delete run ── */
  const handleDeleteRun = (run: PluvioOperacionalRun) => {
    setConfirmDialog({
      title: 'Excluir run',
      description: `Excluir a run de ${run.dt_ref}? Todos os itens serão removidos e esta ação não pode ser desfeita.`,
      onConfirm: () => deleteRunMutation.mutate(run.id),
    });
  };

  /* ── IMPORT JSON ── */
  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!clienteId) { toast.error('Selecione um cliente ativo'); return; }

    setImporting(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);

      const itens = Array.isArray(json) ? json : (json.itens || json.items || json.dados || []);

      let dtRef: string | null = null;
      const dtRefRaw =
        json.dt_ref ?? json.data_referencia ?? json.data_ref ?? json.date ?? json.data ?? json.dt_ref_run;
      const firstItem = Array.isArray(itens) && itens.length > 0 ? itens[0] : null;
      const dtRefFromItem =
        firstItem && typeof firstItem === 'object' && firstItem !== null
          ? (firstItem as Record<string, unknown>).dt_ref ??
          (firstItem as Record<string, unknown>).data_referencia ??
          (firstItem as Record<string, unknown>).data_ref ??
          (firstItem as Record<string, unknown>).date
          : null;
      dtRef = dtRefRaw != null ? String(dtRefRaw).trim() || null : null;
      if (!dtRef && dtRefFromItem != null) dtRef = String(dtRefFromItem).trim() || null;
      if (dtRef && !/^\d{4}-\d{2}-\d{2}$/.test(dtRef)) {
        const d = new Date(dtRef);
        if (!isNaN(d.getTime())) dtRef = d.toISOString().slice(0, 10);
      }

      if (!Array.isArray(itens) || itens.length === 0) throw new Error('Array de itens vazio ou não encontrado. Use um array na raiz [...] ou objeto com "itens"/"items".');

      if (itens.length > 500) throw new Error('Máximo de 500 itens por importação');

      let needsRegiao = false;

      const mappedItems = itens.map((item: Record<string, unknown>) => {
        const getStr = (...keys: string[]) => {
          for (const k of keys) {
            const v = item[k];
            if (v != null && String(v).trim() !== '') return String(v).trim();
          }
          return null;
        };
        const getNum = (...keys: string[]) => {
          for (const k of keys) {
            const v = item[k];
            if (v == null || v === '') return null;
            const s = String(v).trim().toUpperCase();
            if (s === 'N/A' || s === 'N\\/A' || s === 'NA') return null;
            const n = Number(v);
            return isNaN(n) ? null : n;
          }
          return null;
        };
        const bairro = getStr('Bairro', 'bairro_nome', 'bairro', 'nome') || '—';
        const classificacao = getStr('Classificação de Risco Ambiental', 'classificacao_risco', 'classificacao') || 'Baixo';
        const prioridade = getStr('Prioridade operacional', 'prioridade_operacional', 'prioridade') || 'Monitoramento';

        const regiaoNome = getStr('Região', 'regiao', 'regiao_nome');
        const matchedRegiao = regiaoNome
          ? regioes.find((r) => r.regiao.toLowerCase() === regiaoNome.toLowerCase())
          : null;

        if (!matchedRegiao) needsRegiao = true;

        return {
          bairro_nome: bairro,
          regiao_id: matchedRegiao?.id || null,
          classificacao_risco: classificacao,
          situacao_ambiental: getStr('Situação Ambiental', 'situacao_ambiental'),
          chuva_24h_mm: getNum('Chuva 24h (mm)', 'chuva_24h_mm', 'chuva_24h'),
          chuva_72h_mm: getNum('Chuva 72h (mm)', 'chuva_72h_mm', 'chuva_72h'),
          chuva_7d_mm: getNum('Chuva 7d (mm)', 'chuva_7d_mm', 'chuva_7d'),
          dias_com_chuva_7d: getNum('Dias com chuva (7d)', 'dias_com_chuva_7d'),
          janela_sem_chuva: getStr('Janela sem chuva', 'janela_sem_chuva'),
          persistencia_7d: getStr('Persistência 7d', 'persistencia_7d'),
          tendencia: getStr('Tendência', 'tendencia'),
          temp_media_c: getNum('Temperatura média (°C)', 'temp_media_c', 'temp_media'),
          vento_medio_kmh: getNum('Vento médio (km/h)', 'Vento médio (km/h)', 'vento_medio_kmh', 'vento_medio'),
          prob_label: getStr('Probabilidade Label', 'prob_label'),
          prob_base_min: getNum('Prob. Base Min (%)', 'prob_base_min'),
          prob_base_max: getNum('Prob. Base Max (%)', 'prob_base_max'),
          prob_final_min: getNum('Prob. Final Min (%)', 'prob_final_min'),
          prob_final_max: getNum('Prob. Final Max (%)', 'prob_final_max'),
          criadouro_ativo: getStr('Criadouro ativo', 'criadouro_ativo'),
          velocidade_ciclo: getStr('Velocidade do ciclo', 'velocidade_ciclo'),
          janela_emergencia_dias: getStr('Janela emergência (dias)', 'janela_emergencia_dias'),
          prioridade_operacional: prioridade,
          prazo_acao: getStr('Prazo para ação', 'prazo_acao'),
        };
      });

      setPendingParsedItems(mappedItems);
      setPendingNeedsRegiao(needsRegiao);
      setPendingDtRef(dtRef || '');

      if (!dtRef) {
        setShowImportDialog(true);
        setImporting(false);
        if (e.target) e.target.value = '';
        return;
      }

      if (needsRegiao) {
        setShowRegiaoModal(true);
        setImporting(false);
        if (e.target) e.target.value = '';
        return;
      }

      await executeImport(dtRef, mappedItems);

    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
      setImporting(false);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const executeImport = async (dtRef: string, mapped: Partial<PluvioOperacionalItem>[]) => {
    setImporting(true);
    try {
      const runId = await api.pluvioOperacional.createRunGetId({
        cliente_id: clienteId, dt_ref: dtRef, total_bairros: mapped.length,
      });
      const mappedWithRun = mapped.map((v) => ({ ...v, run_id: runId }));
      await api.pluvioOperacional.bulkInsertItems(mappedWithRun);

      toast.success(`Importados ${mapped.length} bairros para run ${dtRef}`);
      queryClient.invalidateQueries({ queryKey: ['admin_pluvio_operacional_runs', clienteId] });
      setShowRegiaoModal(false);
      // import data cleared
    } catch (err: unknown) {
      toast.error(getErrorMessage(err));
    } finally {
      setImporting(false);
    }
  };

  const handleConfirmRegiaoImport = () => {
    if (!fallbackRegiaoId) {
      toast.error('Selecione uma região para os itens órfãos.');
      return;
    }
    if (pendingParsedItems && pendingDtRef) {
      const updatedData = pendingParsedItems.map(v => ({
        ...v,
        regiao_id: v.regiao_id || fallbackRegiaoId
      }));
      executeImport(pendingDtRef, updatedData);
    }
  };

  const handleConfirmDtRef = () => {
    const v = importDtRefValue.trim();
    if (!v) {
      toast.error('Informe a data de referência');
      return;
    }
    setPendingDtRef(v);
    setShowImportDialog(false);

    if (pendingNeedsRegiao) {
      setShowRegiaoModal(true);
    } else if (pendingParsedItems) {
      executeImport(v, pendingParsedItems);
    }
  };

  const cancelImport = () => {
    setShowRegiaoModal(false);
    setShowImportDialog(false);
    setPendingParsedItems(null);
    setPendingDtRef('');
    setImporting(false);
    setImportDtRefValue('');
    setFallbackRegiaoId('');
  };

  const handleDownloadTemplate = () => {
    const template = {
      dt_ref: "2024-03-20",
      itens: [
        {
          bairro: "Centro",
          classificacao_risco: "Baixo",
          chuva_24h_mm: 12.5,
          tendencia: "estável",
          prioridade_operacional: "Monitoramento"
        },
        {
          bairro: "Jardim Primavera",
          classificacao_risco: "Alto",
          chuva_24h_mm: 55.0,
          tendencia: "crescente",
          prioridade_operacional: "Urgente"
        }
      ]
    };
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo_importacao_operacional.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── CRUD: save item ── */
  const handleSaveItem = () => {
    if (!itemForm.bairro_nome || !itemForm.classificacao_risco || !itemForm.prioridade_operacional) {
      toast.error('Bairro, classificação e prioridade são obrigatórios');
      return;
    }
    if (!selectedRun) return;
    saveItemMutation.mutate({ itemData: itemForm, editId: editingItem?.id ?? null });
  };

  /* ── CRUD: delete item ── */
  const handleDeleteItem = (item: PluvioOperacionalItem) => {
    if (!selectedRun) return;
    setConfirmDialog({
      title: 'Excluir item',
      description: `Excluir o item "${item.bairro_nome}"? Esta ação não pode ser desfeita.`,
      onConfirm: () => deleteItemMutation.mutate(item.id),
    });
  };

  const openDetail = (run: PluvioOperacionalRun) => {
    setSelectedRun(run);
    setViewMode('detail');
  };

  const openEditItem = (item: PluvioOperacionalItem) => {
    setEditingItem(item);
    setItemForm({
      bairro_nome: item.bairro_nome,
      regiao_id: item.regiao_id ?? '',
      classificacao_risco: item.classificacao_risco,
      situacao_ambiental: item.situacao_ambiental ?? '',
      chuva_24h_mm: item.chuva_24h_mm?.toString() ?? '',
      chuva_72h_mm: item.chuva_72h_mm?.toString() ?? '',
      chuva_7d_mm: item.chuva_7d_mm?.toString() ?? '',
      dias_com_chuva_7d: item.dias_com_chuva_7d?.toString() ?? '',
      janela_sem_chuva: item.janela_sem_chuva ?? '',
      persistencia_7d: item.persistencia_7d ?? '',
      tendencia: item.tendencia ?? '',
      temp_media_c: item.temp_media_c?.toString() ?? '',
      vento_medio_kmh: item.vento_medio_kmh?.toString() ?? '',
      prob_label: item.prob_label ?? '',
      prob_base_min: item.prob_base_min?.toString() ?? '',
      prob_base_max: item.prob_base_max?.toString() ?? '',
      prob_final_min: item.prob_final_min?.toString() ?? '',
      prob_final_max: item.prob_final_max?.toString() ?? '',
      criadouro_ativo: item.criadouro_ativo ?? '',
      velocidade_ciclo: item.velocidade_ciclo ?? '',
      janela_emergencia_dias: item.janela_emergencia_dias ?? '',
      prioridade_operacional: item.prioridade_operacional,
      prazo_acao: item.prazo_acao ?? '',
    });
    setViewMode('editItem');
  };

  const openNewItem = () => {
    setEditingItem(null);
    setItemForm(emptyItemForm);
    setViewMode('editItem');
  };

  const setField = (key: string, value: string) => setItemForm((p) => ({ ...p, [key]: value }));

  const filtered = runs.filter((r) => {
    const q = search.toLowerCase();
    return r.dt_ref.includes(q) || r.total_bairros.toString().includes(q);
  });

  const { page, totalPages, paginated, goTo, next, prev, reset, total } = usePagination(filtered);

  /* ═══════════════════ ITEM FORM ═══════════════════ */
  if (viewMode === 'editItem') {
    return (
      <div className="space-y-4 lg:space-y-4 animate-fade-in overflow-x-hidden min-w-0 max-w-full">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setViewMode('detail')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold">{editingItem ? 'Editar Item' : 'Novo Item'}</h2>
            <p className="text-sm text-muted-foreground">Run: {selectedRun?.dt_ref}</p>
          </div>
        </div>

        <Card className="rounded-sm border-2 border-cardBorder shadow-lg shadow-black/8 dark:shadow-black/20">
          <CardContent className="p-6">
            <div className="grid gap-4">
              {/* Bairro + Região + Classificação */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Bairro *</Label>
                  <Input value={itemForm.bairro_nome} onChange={(e) => setField('bairro_nome', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Região</Label>
                  <Select value={itemForm.regiao_id} onValueChange={(v) => setField('regiao_id', v)}>
                    <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                    <SelectContent>
                      {regioes.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.regiao}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Classificação Risco *</Label>
                  <Select value={itemForm.classificacao_risco} onValueChange={(v) => setField('classificacao_risco', v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {['Baixo', 'Moderado', 'Alto', 'Muito Alto', 'Crítico'].map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Precipitação */}
              <h3 className="text-sm font-medium text-muted-foreground mt-2">Precipitação</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Chuva 24h (mm)</Label>
                  <Input type="number" step="any" value={itemForm.chuva_24h_mm} onChange={(e) => setField('chuva_24h_mm', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Chuva 72h (mm)</Label>
                  <Input type="number" step="any" value={itemForm.chuva_72h_mm} onChange={(e) => setField('chuva_72h_mm', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Chuva 7d (mm)</Label>
                  <Input type="number" step="any" value={itemForm.chuva_7d_mm} onChange={(e) => setField('chuva_7d_mm', e.target.value)} />
                </div>
              </div>

              {/* Métricas */}
              <h3 className="text-sm font-medium text-muted-foreground mt-2">Métricas</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Dias c/ chuva (7d)</Label>
                  <Input type="number" value={itemForm.dias_com_chuva_7d} onChange={(e) => setField('dias_com_chuva_7d', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Janela sem chuva</Label>
                  <Input value={itemForm.janela_sem_chuva} onChange={(e) => setField('janela_sem_chuva', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Persistência 7d</Label>
                  <Input value={itemForm.persistencia_7d} onChange={(e) => setField('persistencia_7d', e.target.value)} />
                </div>
              </div>

              {/* Classificação e tendência */}
              <h3 className="text-sm font-medium text-muted-foreground mt-2">Análise</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Tendência</Label>
                  <Select value={itemForm.tendencia} onValueChange={(v) => setField('tendencia', v)}>
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
                  <Input value={itemForm.situacao_ambiental} onChange={(e) => setField('situacao_ambiental', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Prioridade Operacional *</Label>
                  <Select value={itemForm.prioridade_operacional} onValueChange={(v) => setField('prioridade_operacional', v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {['Urgente', 'Alta', 'Média', 'Baixa', 'Monitoramento'].map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Probabilidade */}
              <h3 className="text-sm font-medium text-muted-foreground mt-2">Probabilidade</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Label</Label>
                  <Input value={itemForm.prob_label} onChange={(e) => setField('prob_label', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Base Mín (%)</Label>
                  <Input type="number" step="any" value={itemForm.prob_base_min} onChange={(e) => setField('prob_base_min', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Base Máx (%)</Label>
                  <Input type="number" step="any" value={itemForm.prob_base_max} onChange={(e) => setField('prob_base_max', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Final Mín (%)</Label>
                  <Input type="number" step="any" value={itemForm.prob_final_min} onChange={(e) => setField('prob_final_min', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Final Máx (%)</Label>
                  <Input type="number" step="any" value={itemForm.prob_final_max} onChange={(e) => setField('prob_final_max', e.target.value)} />
                </div>
              </div>

              {/* Clima */}
              <h3 className="text-sm font-medium text-muted-foreground mt-2">Clima</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Temp Média (°C)</Label>
                  <Input type="number" step="any" value={itemForm.temp_media_c} onChange={(e) => setField('temp_media_c', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Vento Médio (km/h)</Label>
                  <Input type="number" step="any" value={itemForm.vento_medio_kmh} onChange={(e) => setField('vento_medio_kmh', e.target.value)} />
                </div>
              </div>

              {/* Operacional */}
              <h3 className="text-sm font-medium text-muted-foreground mt-2">Operacional</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Criadouro Ativo</Label>
                  <Input value={itemForm.criadouro_ativo} onChange={(e) => setField('criadouro_ativo', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Velocidade Ciclo</Label>
                  <Input value={itemForm.velocidade_ciclo} onChange={(e) => setField('velocidade_ciclo', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Janela Emergência (dias)</Label>
                  <Input value={itemForm.janela_emergencia_dias} onChange={(e) => setField('janela_emergencia_dias', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Prazo de Ação</Label>
                  <Input value={itemForm.prazo_acao} onChange={(e) => setField('prazo_acao', e.target.value)} />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
              <Button variant="outline" onClick={() => setViewMode('detail')}>Cancelar</Button>
              <Button onClick={handleSaveItem} disabled={saveItemMutation.isPending}>
                {saveItemMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {editingItem ? 'Salvar' : 'Cadastrar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ═══════════════════ NEW RUN ═══════════════════ */
  if (viewMode === 'newRun') {
    return (
    <div className="space-y-4 lg:space-y-4 animate-fade-in overflow-x-hidden min-w-0 max-w-full">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setViewMode('list')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold">Nova Run Operacional</h2>
            <p className="text-sm text-muted-foreground">Crie uma nova geração da tabela operacional.</p>
          </div>
        </div>
        <Card className="rounded-sm border-2 border-cardBorder shadow-lg shadow-black/8 dark:shadow-black/20">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Referência *</Label>
                <Input type="date" value={runForm.dt_ref} onChange={(e) => setRunForm({ dt_ref: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
              <Button variant="outline" onClick={() => setViewMode('list')}>Cancelar</Button>
              <Button onClick={handleCreateRun} disabled={createRunMutation.isPending}>
                {createRunMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Criar Run
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ═══════════════════ RUN DETAIL ═══════════════════ */
  if (viewMode === 'detail' && selectedRun) {
    return (
      <div className="space-y-4 lg:space-y-4 animate-fade-in overflow-x-hidden min-w-0 max-w-full">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => { setViewMode('list'); setSelectedRun(null); }}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Run: {selectedRun.dt_ref}</h2>
            <p className="text-sm text-muted-foreground">{runItems.length} bairro(s)</p>
          </div>
          <Button onClick={openNewItem} className="gap-2">
            <Plus className="w-4 h-4" /> Novo Item
          </Button>
        </div>

        <Card className="rounded-sm border-2 border-cardBorder shadow-lg shadow-black/8 dark:shadow-black/20 overflow-hidden">
          <CardContent className="p-0">
            {loadingItems ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : runItems.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground text-sm">Nenhum item nesta run</p>
            ) : (
              <>
                {/* Mobile */}
                <div className="md:hidden p-3 space-y-3">
                  {runItems.map((item) => (
                    <div key={item.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-sm">{item.bairro_nome}</div>
                        <Badge className={classificacaoColor[item.classificacao_risco] ?? 'bg-muted text-muted-foreground'}>
                          {item.classificacao_risco}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Prioridade: {item.prioridade_operacional} · Chuva 24h: {item.chuva_24h_mm ?? '—'} mm
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => openEditItem(item)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        {isAdmin && (
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteItem(item)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bairro</TableHead>
                        <TableHead>Região</TableHead>
                        <TableHead>Classificação</TableHead>
                        <TableHead>Prioridade</TableHead>
                        <TableHead>Chuva 24h</TableHead>
                        <TableHead>Prob. Final</TableHead>
                        <TableHead>Tendência</TableHead>
                        <TableHead className="w-[100px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {runItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.bairro_nome}</TableCell>
                          <TableCell>{item.regiao?.regiao ?? '—'}</TableCell>
                          <TableCell>
                            <Badge className={classificacaoColor[item.classificacao_risco] ?? 'bg-muted text-muted-foreground'}>
                              {item.classificacao_risco}
                            </Badge>
                          </TableCell>
                          <TableCell>{item.prioridade_operacional}</TableCell>
                          <TableCell>{item.chuva_24h_mm ?? '—'} mm</TableCell>
                          <TableCell>{item.prob_final_min ?? '?'}–{item.prob_final_max ?? '?'}%</TableCell>
                          <TableCell>{item.tendencia ?? '—'}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => openEditItem(item)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              {isAdmin && (
                                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDeleteItem(item)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ═══════════════════ RUNS LIST ═══════════════════ */
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
        title="Tabela Operacional"
        description="Dados operacionais pluviométricos por bairro."
        icon={FileSpreadsheet}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por data..."
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
            onClick={() => document.getElementById('pluvio-oper-json-import')?.click()}
          >
            {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Importar JSON
          </Button>
          <input
            id="pluvio-oper-json-import"
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportJson}
          />
          <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Data de referência</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                O JSON não possui data. Informe a data de referência desta importação.
              </p>
              <div className="space-y-2">
                <Label htmlFor="import-dt-ref">Data de referência (dt_ref)</Label>
                <Input
                  id="import-dt-ref"
                  type="date"
                  value={importDtRefValue}
                  onChange={(e) => setImportDtRefValue(e.target.value)}
                />
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setShowImportDialog(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleConfirmDtRef}>
                  <Upload className="w-4 h-4 mr-2" />
                  Confirmar Data
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button onClick={() => { setRunForm({ dt_ref: '' }); setViewMode('newRun'); }} className="w-full sm:w-auto gap-2">
            <Plus className="w-4 h-4" />
            Nova Run
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
              {/* Mobile */}
              <div className="md:hidden p-3 space-y-3">
                {paginated.map((r) => (
                  <MobileListCard
                    key={r.id}
                    title={`Run: ${r.dt_ref}`}
                    fields={[
                      { label: 'Bairros', value: r.total_bairros.toString() },
                      { label: 'Gerado em', value: new Date(r.dt_gerado).toLocaleString('pt-BR') },
                    ]}
                    onEdit={() => openDetail(r)}
                    onDelete={isAdmin ? () => handleDeleteRun(r) : undefined}
                  />
                ))}
                {filtered.length === 0 && (
                  <p className="text-center py-12 text-muted-foreground text-sm">Nenhuma run encontrada</p>
                )}
              </div>

              {/* Desktop */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data Referência</TableHead>
                      <TableHead>Bairros</TableHead>
                      <TableHead>Gerado em</TableHead>
                      <TableHead className="w-[120px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.dt_ref}</TableCell>
                        <TableCell>{r.total_bairros}</TableCell>
                        <TableCell>{new Date(r.dt_gerado).toLocaleString('pt-BR')}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => openDetail(r)} title="Ver itens">
                              <Eye className="w-4 h-4" />
                            </Button>
                            {isAdmin && (
                              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDeleteRun(r)} title="Excluir">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                          Nenhuma run encontrada
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <TablePagination page={page} totalPages={totalPages} total={total} onGoTo={goTo} onNext={next} onPrev={prev} />
      )}

      <Dialog open={showRegiaoModal} onOpenChange={(open) => !open && cancelImport()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Região Necessária</DialogTitle>
            <DialogDescription>
              Alguns itens do seu JSON não especificaram uma "Região" válida mapeada no sistema.
              Por favor, selecione qual região deseja vincular para os itens órfãos dessa importação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Escolha uma Região</Label>
              <Select value={fallbackRegiaoId} onValueChange={setFallbackRegiaoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {regioes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.regiao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" onClick={cancelImport}>Cancelar Importação</Button>
            <Button onClick={handleConfirmRegiaoImport} disabled={importing || !fallbackRegiaoId}>
              {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPluvioOperacional;
