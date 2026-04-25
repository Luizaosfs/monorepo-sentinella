import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Filter, Search, ChevronLeft, ChevronRight,
  CheckSquare, Square, Users, X, Loader2, MapPin,
  ZoomIn, AlertCircle, Clock, Eye, Activity, Info, Stethoscope, AlertTriangle, PlayCircle,
} from 'lucide-react';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFocosRisco, useAtualizarStatusFoco, getTransicoesPermitidas } from '@/hooks/queries/useFocosRisco';
import { useFocosComCruzamentos } from '@/hooks/queries/useCasosNotificados';
import { TriagemFocoImagemComYolo } from '@/components/gestor/TriagemFocoImagemComYolo';
import { FocoRiscoCard } from '@/components/foco/FocoRiscoCard';
import { StatusBadge } from '@/components/foco/StatusBadge';
import { PrioridadeBadge } from '@/components/foco/PrioridadeBadge';
import { SlaBadge } from '@/components/foco/SlaBadge';
import { OrigemIcone } from '@/components/foco/OrigemIcone';
import { LABEL_STATUS } from '@/types/focoRisco';
import { mapFocoToStatusOperacional, LABEL_STATUS_OPERACIONAL, type FocoStatus } from '@/lib/mapStatusOperacional';
import type {
  FocoRiscoAtivo, FocoRiscoStatus, FocoRiscoPrioridade, FocoRiscoOrigem,
} from '@/types/database';
import { logEvento } from '@/lib/pilotoEventos';
import { getSlaReductionReason } from '@/types/sla';
import {
  LABEL_FASE_SLA, LABEL_STATUS_SLA_INT, COR_STATUS_SLA_INT, formatarTempoMin,
  DESTAQUE_LINHA_SLA, type SlaInteligenteStatus, type FaseSla,
} from '@/lib/slaInteligenteVisual';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';

type FiltroStatus = 'todos' | FocoRiscoStatus;
type FiltroPrioridade = 'todos' | FocoRiscoPrioridade;
type FiltroOrigem = 'todos' | FocoRiscoOrigem;

const PAGE_SIZE = 30;

const STATUS_FILTROS: FiltroStatus[] = [
  'todos', 'suspeita', 'em_triagem', 'aguarda_inspecao', 'em_inspecao',
  'confirmado', 'em_tratamento', 'resolvido', 'descartado',
];

const LABEL_FILTRO_STATUS: Record<string, string> = {
  todos: 'Todos',
  suspeita: 'Suspeita',
  em_triagem: 'Em triagem',
  aguarda_inspecao: 'Aguarda inspeção',
  em_inspecao: 'Em inspeção',
  confirmado: 'Confirmado',
  em_tratamento: 'Em tratamento',
  resolvido: 'Resolvido',
  descartado: 'Descartado',
};

const STATUS_DOT: Record<string, string> = {
  suspeita: 'bg-amber-400',
  em_triagem: 'bg-blue-500',
  aguarda_inspecao: 'bg-purple-500',
  em_inspecao: 'bg-indigo-500',
  confirmado: 'bg-red-500',
  em_tratamento: 'bg-orange-500',
  resolvido: 'bg-emerald-500',
  descartado: 'bg-gray-400',
};

const BORDER_PRIORIDADE: Record<string, string> = {
  P1: 'border-l-[3px] border-l-red-500',
  P2: 'border-l-[3px] border-l-orange-400',
  P3: 'border-l-[3px] border-l-yellow-400',
};

function acaoBtnClass(status: FocoRiscoStatus): string {
  const base = 'h-6 px-2 text-[10px] border transition-colors rounded-md font-semibold whitespace-nowrap';
  switch (status) {
    case 'descartado':
      return `${base} border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40`;
    case 'confirmado':
      return `${base} border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950/40`;
    case 'em_tratamento':
      return `${base} border-orange-200 text-orange-600 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-950/40`;
    case 'resolvido':
      return `${base} border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/40`;
    default:
      return `${base} border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/40`;
  }
}

export default function GestorFocos() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { clienteId } = useClienteAtivo();
  const isMobile = useIsMobile();
  const qc = useQueryClient();

  // Novos focos de cidadão detectados via polling das queries abaixo (refetchInterval)

  // ── Filtros ──────────────────────────────────────────────────────────────────
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');
  const [filtroPrioridade, setFiltroPrioridade] = useState<FiltroPrioridade>('todos');
  const [filtroOrigem, setFiltroOrigem] = useState<FiltroOrigem>('todos');
  const [filtroParado, setFiltroParado] = useState(false);
  const [page, setPage] = useState(1);

  // ── Lightbox ─────────────────────────────────────────────────────────────────
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // ── Seleção em lote ──────────────────────────────────────────────────────────
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [loteStatusDialog, setLoteStatusDialog] = useState<FocoRiscoStatus | null>(null);
  const [loteMotivo, setLoteMotivo] = useState('');
  const [loteLoading, setLoteLoading] = useState(false);

  // ── Sheet / Dialog individual ─────────────────────────────────────────────────
  const [selectedFoco, setSelectedFoco] = useState<FocoRiscoAtivo | null>(null);
  const [transDialog, setTransDialog] = useState<{ foco: FocoRiscoAtivo; statusNovo: FocoRiscoStatus } | null>(null);
  const [motivo, setMotivo] = useState('');

  const atualizar = useAtualizarStatusFoco();

  const filtrosQuery = useMemo(() => ({
    status: filtroStatus !== 'todos' ? [filtroStatus as FocoRiscoStatus] : undefined,
    prioridade: filtroPrioridade !== 'todos' ? [filtroPrioridade] : undefined,
    origem_tipo: filtroOrigem !== 'todos' ? filtroOrigem : undefined,
    page,
    pageSize: PAGE_SIZE,
    orderBy: 'score_prioridade_desc' as const,
  }), [filtroStatus, filtroPrioridade, filtroOrigem, page]);

  const { data, isLoading } = useFocosRisco(clienteId, filtrosQuery);
  const focos = data?.data ?? [];
  const { data: cruzamentosSet } = useFocosComCruzamentos(clienteId);
  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // KPI por status
  const { data: kpiData } = useQuery({
    queryKey: ['focos_risco_kpi', clienteId],
    queryFn: () => api.focosRisco.contagemPorStatus(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.SHORT,
  });

  const { data: usuariosCliente = [] } = useQuery({
    queryKey: ['usuarios_cliente', clienteId],
    queryFn: () => api.usuarios.listByCliente(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.STATIC,
  });

  // Limpa seleção ao mudar filtros ou página
  useEffect(() => { setPage(1); setSelecionados(new Set()); }, [filtroStatus, filtroPrioridade, filtroOrigem, filtroParado]);
  useEffect(() => { setSelecionados(new Set()); }, [page]);

  // Piloto: registra quando focos de alta prioridade ou críticos são exibidos
  useEffect(() => {
    if (!clienteId || focos.length === 0) return;
    const altaPrioridade = focos.filter((f) => f.prioridade === 'P1' || f.prioridade === 'P2');
    const criticos = focos.filter((f) => (f.score_prioridade ?? 0) >= 50);
    if (altaPrioridade.length > 0) {
      logEvento('foco_alta_prioridade_listado', clienteId, { count: altaPrioridade.length, page });
    }
    if (criticos.length > 0) {
      logEvento('foco_critico_exibido', clienteId, { count: criticos.length, page });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focos]);

  const usuarioPorId = useMemo(() => {
    const m = new Map<string, { nome?: string | null; email?: string | null }>();
    for (const u of usuariosCliente) m.set(u.id, { nome: u.nome, email: u.email });
    return m;
  }, [usuariosCliente]);

  // Busca client-side dentro da página atual
  const focosFiltrados = useMemo(() => {
    const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;
    const limiteParado = Date.now() - SETE_DIAS_MS;
    let resultado = focos;
    if (busca) {
      const q = busca.toLowerCase();
      resultado = resultado.filter(
        (f) =>
          (f.logradouro ?? '').toLowerCase().includes(q) ||
          (f.bairro ?? '').toLowerCase().includes(q) ||
          (f.endereco_normalizado ?? '').toLowerCase().includes(q),
      );
    }
    if (filtroParado) {
      resultado = resultado.filter(
        (f) => f.updated_at && new Date(f.updated_at).getTime() < limiteParado,
      );
    }
    return resultado;
  }, [focos, busca, filtroParado]);

  // Contagem de filtros ativos
  const filtrosAtivos = [
    filtroStatus !== 'todos',
    filtroPrioridade !== 'todos',
    filtroOrigem !== 'todos',
    !!busca,
    filtroParado,
  ].filter(Boolean).length;

  // ── Lote: união de transições disponíveis para os selecionados ────────────────
  const transicoesLote = useMemo<FocoRiscoStatus[]>(() => {
    if (selecionados.size === 0) return [];
    const focosSel = focosFiltrados.filter((f) => selecionados.has(f.id));
    if (focosSel.length === 0) return [];
    const union = new Set<FocoRiscoStatus>();
    for (const f of focosSel) {
      for (const t of getTransicoesPermitidas(f.status as FocoRiscoStatus)) union.add(t);
    }
    const ordem: FocoRiscoStatus[] = [
      'em_triagem', 'aguarda_inspecao', 'confirmado', 'em_tratamento', 'resolvido', 'descartado',
    ];
    return ordem.filter((t) => union.has(t));
  }, [selecionados, focosFiltrados]);

  const elegiveisPorLoteStatus = useMemo(() => {
    if (!loteStatusDialog) return [];
    return focosFiltrados.filter(
      (f) =>
        selecionados.has(f.id) &&
        getTransicoesPermitidas(f.status as FocoRiscoStatus).includes(loteStatusDialog),
    );
  }, [loteStatusDialog, focosFiltrados, selecionados]);

  const todosSelecionados = focosFiltrados.length > 0 && selecionados.size === focosFiltrados.length;
  const algunsSelecionados = selecionados.size > 0 && selecionados.size < focosFiltrados.length;

  function toggleSelecionado(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTodos() {
    setSelecionados(
      selecionados.size === focosFiltrados.length
        ? new Set()
        : new Set(focosFiltrados.map((f) => f.id)),
    );
  }

  function limparSelecao() { setSelecionados(new Set()); }
  function limparFiltros() {
    setFiltroStatus('todos');
    setFiltroPrioridade('todos');
    setFiltroOrigem('todos');
    setBusca('');
    setFiltroParado(false);
  }

  // ── Ação em lote: chama API diretamente, invalida uma única vez ao final ──────
  async function confirmarStatusEmLote() {
    if (!loteStatusDialog || selecionados.size === 0) return;
    const statusAlvo = loteStatusDialog;
    if (statusAlvo === 'descartado' && !loteMotivo) {
      toast.error('Motivo obrigatório para descartar.');
      return;
    }
    const elegíveis = [...elegiveisPorLoteStatus];
    if (elegíveis.length === 0) {
      toast.error('Nenhum foco selecionado pode ser movido para esse status.');
      return;
    }
    setLoteLoading(true);
    const failed = new Set<string>();
    let ok = 0;
    for (const foco of elegíveis) {
      try {
        await api.focosRisco.transicionar(foco.id, statusAlvo, loteMotivo || undefined);
        ok++;
      } catch {
        failed.add(foco.id);
      }
    }
    qc.invalidateQueries({ queryKey: ['focos_risco'] });
    qc.invalidateQueries({ queryKey: ['focos_risco_kpi'] });
    setLoteLoading(false);
    setLoteStatusDialog(null);
    setLoteMotivo('');
    const pulados = selecionados.size - elegíveis.length;
    const TERMINAL: FocoRiscoStatus[] = ['resolvido', 'descartado'];
    const isTerminal = TERMINAL.includes(statusAlvo);
    if (ok > 0) {
      const extra = pulados > 0 ? ` · ${pulados} pulado(s) (status incompatível)` : '';
      const sufixo = isTerminal ? ' · Use o filtro para visualizá-los.' : '';
      toast.success(`${ok} foco(s) movidos para "${LABEL_STATUS[statusAlvo] ?? statusAlvo}"${extra}${sufixo}`);
      if (isTerminal && filtroStatus === 'todos') {
        // Oferece acesso rápido ao filtro do status terminal recém-aplicado
        setTimeout(() => setFiltroStatus(statusAlvo), 800);
      }
    }
    if (failed.size > 0) toast.error(`${failed.size} foco(s) não puderam ser atualizados.`);
    setSelecionados(failed);
  }

  // ── Transição individual: redireciona para lote se há seleção múltipla ────────
  function handleTransicionar(foco: FocoRiscoAtivo, statusNovo: string) {
    if (selecionados.has(foco.id) && selecionados.size > 1) {
      setLoteStatusDialog(statusNovo as FocoRiscoStatus);
      setLoteMotivo('');
    } else {
      setTransDialog({ foco, statusNovo: statusNovo as FocoRiscoStatus });
      setMotivo('');
    }
  }

  async function confirmarTransicao() {
    if (!transDialog) return;
    const TERMINAL: FocoRiscoStatus[] = ['resolvido', 'descartado'];
    const isTerminal = TERMINAL.includes(transDialog.statusNovo);
    try {
      await atualizar.mutateAsync({
        focoId: transDialog.foco.id,
        statusNovo: transDialog.statusNovo,
        motivo: motivo || undefined,
      });
      const sufixo = isTerminal ? ' · Use o filtro para visualizá-lo.' : '';
      toast.success(`Status alterado para "${LABEL_STATUS[transDialog.statusNovo] ?? transDialog.statusNovo}".${sufixo}`);
      qc.invalidateQueries({ queryKey: ['focos_risco_kpi'] });
      setTransDialog(null);
      setSelectedFoco(null);
      if (isTerminal && filtroStatus === 'todos') {
        setTimeout(() => setFiltroStatus(transDialog.statusNovo), 800);
      }
    } catch (err) {
      const msg = (err as { message?: string })?.message;
      toast.error(msg || 'Falha ao atualizar status.');
    }
  }

  // KPI cards config
  const kpiCards = [
    {
      label: 'Suspeitas',
      key: 'suspeita',
      icon: <AlertCircle className="w-4 h-4" />,
      color: 'text-amber-600',
      bg: 'bg-amber-50 dark:bg-amber-950/20',
      border: 'border-amber-200 dark:border-amber-800',
      dot: 'bg-amber-400',
    },
    {
      label: 'Em triagem',
      key: 'em_triagem',
      icon: <Eye className="w-4 h-4" />,
      color: 'text-blue-600',
      bg: 'bg-blue-50 dark:bg-blue-950/20',
      border: 'border-blue-200 dark:border-blue-800',
      dot: 'bg-blue-500',
    },
    {
      label: 'Aguarda inspeção',
      key: 'aguarda_inspecao',
      icon: <Clock className="w-4 h-4" />,
      color: 'text-purple-600',
      bg: 'bg-purple-50 dark:bg-purple-950/20',
      border: 'border-purple-200 dark:border-purple-800',
      dot: 'bg-purple-500',
    },
    {
      label: 'Em inspeção',
      key: 'em_inspecao',
      icon: <PlayCircle className="w-4 h-4" />,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50 dark:bg-indigo-950/20',
      border: 'border-indigo-200 dark:border-indigo-800',
      dot: 'bg-indigo-500',
    },
    {
      label: 'Em atendimento',
      key: 'em_tratamento',
      icon: <Activity className="w-4 h-4" />,
      color: 'text-orange-600',
      bg: 'bg-orange-50 dark:bg-orange-950/20',
      border: 'border-orange-200 dark:border-orange-800',
      dot: 'bg-orange-500',
    },
  ];

  // ── SLA Inteligente — filtro por query param ─────────────────────────────────
  const slaIntParam = searchParams.get('sla_int') as SlaInteligenteStatus | null;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className={`p-4 lg:p-6 space-y-4 animate-fade-in ${selecionados.size > 0 ? 'pb-56' : 'pb-6'}`}>

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-foreground">Focos de Risco</h1>
          <p className="text-sm text-muted-foreground">{total} foco{total !== 1 ? 's' : ''} registrados</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/gestor/mapa')}>
          <MapPin className="w-4 h-4 mr-1" />
          Mapa
        </Button>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpiCards.map((card) => {
          const count = kpiData
            ? (Array.isArray(kpiData)
              ? kpiData.find((k: { status: string }) => k.status === card.key)?.count ?? 0
              : (kpiData as Record<string, number>)[card.key] ?? 0)
            : null;
          return (
            <button
              key={card.key}
              onClick={() => setFiltroStatus(filtroStatus === card.key ? 'todos' : card.key as FiltroStatus)}
              className={`rounded-xl border p-3 flex items-center gap-3 text-left transition-all hover:shadow-sm ${card.bg} ${card.border} ${
                filtroStatus === card.key ? 'ring-2 ring-offset-1 ring-primary/40' : ''
              }`}
            >
              <div className={`${card.color} shrink-0`}>{card.icon}</div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground leading-none mb-1 truncate">{card.label}</p>
                {count === null
                  ? <Skeleton className="h-5 w-8" />
                  : <p className={`text-xl font-black leading-none ${card.color}`}>{count}</p>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Banner — filtro SLA Inteligente vindo da CentralOperacional */}
      {slaIntParam && (
        <div className={`flex items-center gap-2.5 rounded-lg border px-3.5 py-2 text-sm font-medium ${
          slaIntParam === 'vencido' ? 'border-red-200 bg-red-50/70 text-red-700 dark:bg-red-950/20 dark:text-red-400 dark:border-red-800/50' :
          slaIntParam === 'critico' ? 'border-orange-200 bg-orange-50/70 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-800/50' :
          'border-amber-200 bg-amber-50/70 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800/50'
        }`}>
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">
            SLA Inteligente: focos com status <strong>{LABEL_STATUS_SLA_INT[slaIntParam]}</strong> destacados na tabela
          </span>
          <button
            className="ml-auto opacity-60 hover:opacity-100 transition-opacity"
            onClick={() => setSearchParams({})}
            title="Dispensar filtro"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Filtros */}
      <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por endereço ou bairro..."
              className="pl-9 h-9 text-sm bg-background"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          {filtrosAtivos > 0 && (
            <Button variant="outline" size="sm" className="h-9 gap-1.5 shrink-0" onClick={limparFiltros}>
              <X className="w-3.5 h-3.5" />
              Limpar
              <span className="bg-primary text-primary-foreground rounded-full text-[10px] font-bold w-4 h-4 flex items-center justify-center leading-none">
                {filtrosAtivos}
              </span>
            </Button>
          )}
        </div>

        {/* G3: filtro rápido de focos parados */}
        <button
          onClick={() => setFiltroParado(!filtroParado)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors w-fit ${
            filtroParado
              ? 'bg-orange-500 text-white border-orange-500'
              : 'border-border bg-background text-muted-foreground hover:bg-muted'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${filtroParado ? 'bg-white' : 'bg-orange-400'}`} />
          Parados +7 dias
        </button>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Status</p>
            <div className="flex flex-wrap gap-1">
              {STATUS_FILTROS.map((s) => (
                <button
                  key={s}
                  onClick={() => setFiltroStatus(s)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    filtroStatus === s
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {s !== 'todos' && (
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[s] ?? 'bg-gray-400'}`} />
                  )}
                  {LABEL_FILTRO_STATUS[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Prioridade</p>
            <div className="flex flex-wrap gap-1">
              {(['todos', 'P1', 'P2', 'P3'] as FiltroPrioridade[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setFiltroPrioridade(p)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    filtroPrioridade === p
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {p === 'P1' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />}
                  {p === 'P2' && <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />}
                  {p === 'P3' && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />}
                  {p === 'todos' ? 'Todas' : p}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Origem</p>
            <div className="flex flex-wrap gap-1">
              {(['todos', 'drone', 'agente', 'cidadao', 'pluvio', 'manual'] as FiltroOrigem[]).map((o) => (
                <button
                  key={o}
                  onClick={() => setFiltroOrigem(o)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    filtroOrigem === o
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {o !== 'todos' && <OrigemIcone origem={o as FocoRiscoOrigem} />}
                  {o === 'todos' ? 'Todas' : o}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className={`rounded-xl border h-14 flex items-center px-3 gap-3 ${
              i % 3 === 0 ? 'border-l-[3px] border-l-red-300' : i % 3 === 1 ? 'border-l-[3px] border-l-orange-300' : 'border-l-[3px] border-l-yellow-300'
            }`}>
              <Skeleton className="w-4 h-4 rounded" />
              <Skeleton className="w-10 h-10 rounded-md" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-8 rounded-full" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24 ml-auto" />
            </div>
          ))}
        </div>
      ) : focosFiltrados.length === 0 ? (
        <div className="rounded-xl border border-dashed py-14 flex flex-col items-center gap-3 text-center">
          <Filter className="w-8 h-8 text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold">Nenhum foco encontrado</p>
            <p className="text-xs text-muted-foreground">Ajuste os filtros ou a busca</p>
          </div>
          {filtrosAtivos > 0 && (
            <Button variant="outline" size="sm" className="text-xs h-8" onClick={limparFiltros}>
              Limpar filtros
            </Button>
          )}
        </div>
      ) : isMobile ? (
        /* ── Mobile: cards ─────────────────────────────────────────────────── */
        <div className="space-y-3">
          <div className="flex items-center gap-3 px-1">
            <button
              onClick={toggleTodos}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
            >
              {todosSelecionados
                ? <CheckSquare className="w-4 h-4 text-primary" />
                : algunsSelecionados
                  ? <CheckSquare className="w-4 h-4 text-primary/50" />
                  : <Square className="w-4 h-4" />}
              {todosSelecionados ? 'Desmarcar todos' : 'Selecionar todos'}
            </button>
            <span className="text-xs text-muted-foreground">
              {total} foco(s) · pág. {page}/{totalPages}
            </span>
          </div>

          {focosFiltrados.map((foco) => {
            const isSelecionado = selecionados.has(foco.id);
            const borderClass = BORDER_PRIORIDADE[foco.prioridade ?? ''] ?? '';
            const slaVencido = foco.sla_status === 'vencido';
            return (
              <div
                key={foco.id}
                className={`rounded-xl border transition-colors overflow-hidden ${borderClass} ${
                  slaVencido ? 'bg-red-50/40 dark:bg-red-950/10 border-red-200/60 dark:border-red-900/40' :
                  isSelecionado ? 'border-primary/40 bg-primary/5' : 'border-border/60'
                }`}
              >
                <div className="flex items-start justify-between px-3 pt-3 pb-1 gap-3">
                  <div onClick={(e) => toggleSelecionado(foco.id, e)} className="cursor-pointer mt-0.5">
                    <Checkbox checked={isSelecionado} />
                  </div>
                  {foco.origem_image_url && (
                    <div
                      className="relative group cursor-zoom-in shrink-0"
                      onClick={(e) => { e.stopPropagation(); setLightboxUrl(foco.origem_image_url); }}
                    >
                      <img
                        src={foco.origem_image_url}
                        alt="Imagem do levantamento"
                        className="w-16 h-16 rounded-lg object-cover border border-border/60"
                      />
                      <div className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <ZoomIn className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  )}
                </div>
                <div className="px-3 pb-3 relative">
                  {cruzamentosSet?.has(foco.origem_levantamento_item_id ?? '') && (
                    <div className="absolute top-0 right-3 z-10 -translate-y-1/2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-400 shadow-sm">
                        <Stethoscope className="w-3 h-3" />
                        Caso próximo
                      </span>
                    </div>
                  )}
                  <FocoRiscoCard
                    foco={foco}
                    usuarioPorId={usuarioPorId}
                    onAbrirDetalhe={() => setSelectedFoco(foco)}
                    onVerNoMapa={() => navigate(`/gestor/mapa?foco=${foco.id}`)}
                    onTransicionar={(f, s) => handleTransicionar(f, s)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Desktop: tabela ───────────────────────────────────────────────── */
        <div className="rounded-xl border border-border/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border/60 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-3 w-10">
                    <button onClick={toggleTodos}>
                      {todosSelecionados
                        ? <CheckSquare className="w-4 h-4 text-primary" />
                        : algunsSelecionados
                          ? <CheckSquare className="w-4 h-4 text-primary/50" />
                          : <Square className="w-4 h-4 text-muted-foreground" />}
                    </button>
                  </th>
                  <th className="px-2 py-3 w-14 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Img</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left px-3 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Prior.</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">SLA</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Endereço</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Origem</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {focosFiltrados.map((foco) => {
                  const transicoes = getTransicoesPermitidas(foco.status as FocoRiscoStatus);
                  const isSelecionado = selecionados.has(foco.id);
                  const borderClass = BORDER_PRIORIDADE[foco.prioridade ?? ''] ?? '';
                  const slaVencido = foco.sla_status === 'vencido';
                  const slaIntStatus = foco.status_sla_inteligente as SlaInteligenteStatus | null;
                  const slaIntDestaqueClasse = DESTAQUE_LINHA_SLA[slaIntStatus ?? 'ok'] ?? '';
                  return (
                    <tr
                      key={foco.id}
                      className={`transition-colors cursor-pointer ${borderClass} ${
                        slaVencido || slaIntStatus === 'vencido'
                          ? 'bg-red-50/50 dark:bg-red-950/10 hover:bg-red-50 dark:hover:bg-red-950/20'
                          : slaIntStatus === 'critico'
                          ? slaIntDestaqueClasse
                          : isSelecionado
                            ? 'bg-primary/5 hover:bg-primary/8'
                            : 'hover:bg-muted/30'
                      }`}
                      onClick={() => setSelectedFoco(foco)}
                    >
                      <td className="px-3 py-3" onClick={(e) => toggleSelecionado(foco.id, e)}>
                        <Checkbox checked={isSelecionado} />
                      </td>
                      <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                        {foco.origem_image_url ? (
                          <div
                            className="relative group cursor-zoom-in w-10 h-10"
                            onClick={() => setLightboxUrl(foco.origem_image_url)}
                          >
                            <img
                              src={foco.origem_image_url}
                              alt="Foco"
                              className="w-10 h-10 rounded-md object-cover border border-border/60"
                            />
                            <div className="absolute inset-0 bg-black/40 rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <ZoomIn className="w-3.5 h-3.5 text-white" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center">
                            <OrigemIcone origem={foco.origem_tipo as FocoRiscoOrigem} />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <StatusBadge status={foco.status as FocoRiscoStatus} />
                          <span className="text-[10px] text-muted-foreground/70">
                            {LABEL_STATUS_OPERACIONAL[mapFocoToStatusOperacional(foco.status as FocoStatus)]}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <PrioridadeBadge prioridade={foco.prioridade} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1">
                            <SlaBadge slaStatus={foco.sla_status} prazoEm={foco.sla_prazo_em} />
                            {(() => {
                              const reason = getSlaReductionReason(foco.prioridade, foco.sla_prazo_em, foco.confirmado_em);
                              return reason ? (
                                <Info
                                  className="w-3.5 h-3.5 text-amber-500 cursor-help shrink-0"
                                  title={reason}
                                />
                              ) : null;
                            })()}
                          </div>
                          {foco.status_sla_inteligente && foco.status_sla_inteligente !== 'encerrado' && (
                            <div className="flex items-center gap-1">
                              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${COR_STATUS_SLA_INT[foco.status_sla_inteligente as SlaInteligenteStatus]}`}>
                                {LABEL_STATUS_SLA_INT[foco.status_sla_inteligente as SlaInteligenteStatus]}
                              </span>
                              {foco.fase_sla && (
                                <span className="text-[9px] text-muted-foreground/60">
                                  {LABEL_FASE_SLA[foco.fase_sla as FaseSla]} · {formatarTempoMin(foco.tempo_em_estado_atual_min)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        {foco.codigo_foco && (
                          <div className="text-[10px] font-mono text-muted-foreground/70 mb-0.5 tracking-wide">
                            {foco.codigo_foco}
                          </div>
                        )}
                        <div className="truncate font-medium text-xs">
                          {foco.logradouro || foco.endereco_normalizado || '—'}
                        </div>
                        {(foco.bairro || foco.quarteirao) && (
                          <div className="text-[11px] text-muted-foreground truncate">
                            {[foco.bairro, foco.quarteirao ? `Q${foco.quarteirao}` : null].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          {(() => {
                            const cfg: Record<string, { label: string; cls: string }> = {
                              cidadao: { label: 'Cidadão', cls: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800' },
                              drone:   { label: 'Drone',   cls: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' },
                              agente:  { label: 'Agente',  cls: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800' },
                              pluvio:  { label: 'Pluvial', cls: 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800' },
                              manual:  { label: 'Manual',  cls: 'bg-muted text-muted-foreground border-border' },
                            };
                            const c = cfg[foco.origem_tipo];
                            return c ? (
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold ${c.cls}`}>
                                <OrigemIcone origem={foco.origem_tipo as FocoRiscoOrigem} className="!w-3 !h-3" />
                                {c.label}
                              </span>
                            ) : null;
                          })()}
                          {foco.origem_tipo === 'cidadao' &&
                            new Date(foco.created_at).getTime() > Date.now() - 30 * 60_000 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 animate-pulse">
                              NOVO
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1 flex-wrap">
                          {transicoes.map((t) => {
                            const bloqueadoPorDados =
                              !foco.tem_dados_minimos &&
                              foco.status === 'suspeita' &&
                              (t === 'em_triagem' || t === 'aguarda_inspecao');
                            const titleBloqueado = bloqueadoPorDados
                              ? `Dados incompletos: ${(foco.pendencias ?? []).map((p) => ({
                                  sem_localizacao: 'localização',
                                  sem_bairro: 'bairro',
                                  sem_descricao: 'descrição',
                                  sem_evidencia: 'evidência',
                                }[p] ?? p)).join(', ')}`
                              : undefined;
                            return (
                              <button
                                key={t}
                                className={acaoBtnClass(t)}
                                disabled={bloqueadoPorDados}
                                title={titleBloqueado}
                                onClick={() => handleTransicionar(foco, t)}
                              >
                                {LABEL_STATUS[t] ?? t}
                              </button>
                            );
                          })}
                          <button
                            className="h-6 px-2 text-[10px] rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors font-semibold"
                            onClick={() => navigate(`/gestor/focos/${foco.id}`)}
                          >
                            Detalhe
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline" size="sm" className="h-8"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline" size="sm" className="h-8"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* ── Toolbar flutuante de lote ─────────────────────────────────────────── */}
      {selecionados.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/98 backdrop-blur shadow-2xl">
          <div className="max-w-3xl mx-auto p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">{selecionados.size} foco(s) selecionado(s)</span>
              </div>
              <button onClick={limparSelecao} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            {transicoesLote.length > 0 && (
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-xs text-muted-foreground">Mover para:</span>
                {transicoesLote.map((t) => (
                  <button
                    key={t}
                    className={`rounded-md font-semibold ${acaoBtnClass(t)}`}
                    disabled={loteLoading}
                    onClick={() => { setLoteStatusDialog(t); setLoteMotivo(''); }}
                  >
                    {LABEL_STATUS[t] ?? t}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Lightbox ─────────────────────────────────────────────────────────── */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/40 rounded-full p-2"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightboxUrl}
            alt="Imagem ampliada"
            className="max-w-full max-h-[90vh] rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* ── Sheet lateral ────────────────────────────────────────────────────── */}
      <Sheet open={!!selectedFoco} onOpenChange={(v) => !v && setSelectedFoco(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0">
          <SheetHeader className="p-6 border-b border-border/60">
            <SheetTitle>Detalhe do Foco</SheetTitle>
          </SheetHeader>
          {selectedFoco && (
            <div className="p-6 space-y-4 overflow-y-auto">
              {selectedFoco.origem_image_url && (
                <div
                  className="rounded-xl border border-border/60 bg-black/10 p-2 cursor-zoom-in"
                  onClick={() => setLightboxUrl(selectedFoco.origem_image_url)}
                >
                  <TriagemFocoImagemComYolo
                    imageUrl={selectedFoco.origem_image_url}
                    itemId={selectedFoco.origem_levantamento_item_id}
                    prioridade={selectedFoco.prioridade}
                    variant="dialog"
                  />
                </div>
              )}
              <FocoRiscoCard
                foco={selectedFoco}
                usuarioPorId={usuarioPorId}
                onTransicionar={handleTransicionar}
              />
              <Button
                className="w-full"
                onClick={() => navigate(`/gestor/focos/${selectedFoco.id}`)}
              >
                Ver detalhe completo
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Dialog individual ────────────────────────────────────────────────── */}
      <Dialog open={!!transDialog} onOpenChange={(v) => !v && setTransDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Alterar para: {transDialog ? (LABEL_STATUS[transDialog.statusNovo] ?? transDialog.statusNovo) : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {(transDialog?.statusNovo === 'descartado' || transDialog?.statusNovo === 'resolvido') && (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>Esta ação é <strong>irreversível</strong>. O foco não poderá ser reaberto — apenas um novo foco pode ser criado.</span>
              </div>
            )}
            <Label htmlFor="motivo">
              Motivo {transDialog?.statusNovo === 'descartado' ? '(obrigatório)' : '(opcional)'}
            </Label>
            <Input
              id="motivo"
              placeholder="Descreva o motivo da transição..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransDialog(null)}>Cancelar</Button>
            <Button
              onClick={confirmarTransicao}
              disabled={atualizar.isPending || (transDialog?.statusNovo === 'descartado' && !motivo)}
            >
              {atualizar.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog lote ──────────────────────────────────────────────────────── */}
      <Dialog open={!!loteStatusDialog} onOpenChange={(v) => !v && setLoteStatusDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Mover para: {loteStatusDialog ? (LABEL_STATUS[loteStatusDialog] ?? loteStatusDialog) : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {(loteStatusDialog === 'descartado' || loteStatusDialog === 'resolvido') && (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>Esta ação é <strong>irreversível</strong>. Os focos não poderão ser reabertos — apenas novos focos podem ser criados.</span>
              </div>
            )}
            {elegiveisPorLoteStatus.length < selecionados.size && (
              <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-md px-3 py-2">
                <strong>{elegiveisPorLoteStatus.length}</strong> de {selecionados.size} foco(s) serão movidos.
                Os demais têm status incompatível e serão ignorados.
              </p>
            )}
            {elegiveisPorLoteStatus.length === selecionados.size && (
              <p className="text-xs text-muted-foreground">
                {selecionados.size} foco(s) serão movidos.
              </p>
            )}
            <Label htmlFor="motivo-lote">
              Motivo {loteStatusDialog === 'descartado' ? '(obrigatório)' : '(opcional)'}
            </Label>
            <Input
              id="motivo-lote"
              placeholder="Descreva o motivo..."
              value={loteMotivo}
              onChange={(e) => setLoteMotivo(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLoteStatusDialog(null)}>Cancelar</Button>
            <Button
              onClick={confirmarStatusEmLote}
              disabled={loteLoading || (loteStatusDialog === 'descartado' && !loteMotivo) || elegiveisPorLoteStatus.length === 0}
            >
              {loteLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : `Confirmar (${elegiveisPorLoteStatus.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
