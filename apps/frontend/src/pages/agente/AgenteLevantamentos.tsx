import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import type { FocoRiscoAtivo, FocoRiscoStatus } from '@/types/database';
import { LABEL_STATUS } from '@/types/focoRisco';
import { StatusBadge } from '@/components/foco/StatusBadge';
import { PrioridadeBadge } from '@/components/foco/PrioridadeBadge';
import { SlaBadge } from '@/components/foco/SlaBadge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Loader2, Search, MapPin, ChevronRight,
  Map, PlusCircle, ListTodo, Users, RefreshCw,
  AlertTriangle, Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import PullToRefresh from '@/components/PullToRefresh';
import { captureError } from '@/lib/sentry';
import { useDebounce } from '@/hooks/useDebounce';
import { carregarRascunho, formatarTempoRascunho } from '@/lib/vistoriaRascunho';

// ── Constantes ────────────────────────────────────────────────────────────────

const ACTIVE_STATUSES: FocoRiscoStatus[] = [
  'aguarda_inspecao', 'em_inspecao', 'confirmado', 'em_tratamento',
];

/** Ação rápida de transição disponível para cada status. */
const ACAO_RAPIDA: Partial<Record<FocoRiscoStatus, { label: string; proximo: FocoRiscoStatus; cor: string }>> = {
  aguarda_inspecao: { label: 'Iniciar inspeção', proximo: 'em_inspecao',    cor: 'bg-blue-600 hover:bg-blue-700 text-white' },
  em_inspecao:      { label: 'Confirmar foco',   proximo: 'confirmado',     cor: 'bg-amber-600 hover:bg-amber-700 text-white' },
  confirmado:       { label: 'Iniciar tratamento', proximo: 'em_tratamento', cor: 'bg-purple-600 hover:bg-purple-700 text-white' },
  em_tratamento:    { label: 'Marcar resolvido', proximo: 'resolvido',      cor: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
};

/** Borda esquerda colorida por prioridade. */
const BORDA_PRIORIDADE: Record<string, string> = {
  P1: 'border-l-[3px] border-l-red-500',
  P2: 'border-l-[3px] border-l-orange-500',
  P3: 'border-l-[3px] border-l-amber-500',
  P4: 'border-l-[3px] border-l-blue-400',
  P5: 'border-l-[3px] border-l-gray-300',
};

type StatusChip = FocoRiscoStatus | 'todos';
type ViewTab    = 'minha_fila' | 'fila_aberta';

const STATUS_CHIPS: { key: StatusChip; label: string }[] = [
  { key: 'todos',            label: 'Ativos' },
  { key: 'aguarda_inspecao', label: 'Aguardando' },
  { key: 'em_inspecao',      label: 'Em inspeção' },
  { key: 'em_tratamento',    label: 'Tratamento' },
  { key: 'resolvido',        label: 'Resolvidos' },
];

// ── Componente principal ──────────────────────────────────────────────────────

const AgenteLevantamentos = () => {
  const { clienteId } = useClienteAtivo();
  const { usuario }   = useAuth();
  const navigate      = useNavigate();
  const qc            = useQueryClient();

  const [tab,         setTab]         = useState<ViewTab>('minha_fila');
  const [search,      setSearch]      = useState('');
  const [statusChip,  setStatusChip]  = useState<StatusChip>('todos');
  const debouncedSearch = useDebounce(search, 300);
  // IDs de focos bloqueados pós-transição (1.5s cooldown para evitar toque duplo)
  const [lockedFocos, setLockedFocos] = useState<Set<string>>(new Set());

  const lockFoco = (focoId: string) => {
    setLockedFocos((prev) => new Set(prev).add(focoId));
    setTimeout(() => {
      setLockedFocos((prev) => { const s = new Set(prev); s.delete(focoId); return s; });
    }, 1500);
  };

  // ── Query: Minha Fila — focos atribuídos ao agente ─────────────────────────
  const {
    data:    minhaFilaResult,
    isLoading: loadingFila,
    refetch: refetchFila,
  } = useQuery({
    queryKey: ['focos_minha_fila', clienteId, usuario?.id],
    queryFn: () =>
      api.focosRisco.list(clienteId!, {
        responsavel_id: usuario!.id,
        status: [...ACTIVE_STATUSES, 'resolvido'],
        pageSize: 200,
      }),
    enabled:   !!clienteId && !!usuario?.id,
    staleTime: STALE.SHORT,
  });

  // ── Query: Fila Aberta — aguarda_inspecao sem responsável ──────────────────
  const {
    data:    filaAbertaResult,
    isLoading: loadingAberta,
    refetch: refetchAberta,
  } = useQuery({
    queryKey: ['focos_disponiveis', clienteId],
    queryFn: async () => {
      const result = await api.focosRisco.list(clienteId!, {
        status: ['aguarda_inspecao'],
        pageSize: 100,
      });
      return { ...result, data: result.data.filter((f) => !f.responsavel_id) };
    },
    enabled:   !!clienteId && tab === 'fila_aberta',
    staleTime: STALE.SHORT,
  });

  // ── Mutation: assumir foco (claim) ─────────────────────────────────────────
  const claimMutation = useMutation({
    mutationFn: (focoId: string) =>
      api.focosRisco.atribuirAgente(focoId, usuario!.id, 'Agente assumiu foco da fila aberta'),
    onSuccess: () => {
      toast.success('Foco assumido! Aparece agora na sua fila.');
      qc.invalidateQueries({ queryKey: ['focos_minha_fila',  clienteId] });
      qc.invalidateQueries({ queryKey: ['focos_atribuidos',  clienteId] });
      qc.invalidateQueries({ queryKey: ['focos_disponiveis', clienteId] });
      qc.invalidateQueries({ queryKey: ['focos_risco',       clienteId] });
      setTab('minha_fila');
    },
    onError: (err) => {
      captureError(err, { mutation: 'claimFoco' });
      toast.error('Erro ao assumir foco');
    },
  });

  // ── Mutation: transição rápida de status ───────────────────────────────────
  const transitionMutation = useMutation({
    mutationFn: ({ focoId, statusNovo }: { focoId: string; statusNovo: FocoRiscoStatus }) =>
      api.focosRisco.transicionar(focoId, statusNovo, undefined, usuario?.id),
    onSuccess: (_, { focoId, statusNovo }) => {
      const label = LABEL_STATUS[statusNovo] ?? statusNovo;
      toast.success(`Atualizado para "${label}"`);
      lockFoco(focoId);
      qc.invalidateQueries({ queryKey: ['focos_minha_fila', clienteId] });
      qc.invalidateQueries({ queryKey: ['focos_atribuidos', clienteId] });
      qc.invalidateQueries({ queryKey: ['focos_risco',      clienteId] });
    },
    onError: (err) => {
      captureError(err, { mutation: 'transitionFoco' });
      toast.error('Erro ao atualizar status');
    },
  });

  // ── Derived data ───────────────────────────────────────────────────────────
  const todosAtivos   = minhaFilaResult?.data ?? [];
  const filaAberta    = filaAbertaResult?.data ?? [];

  const counts = useMemo(() => ({
    aguarda:    todosAtivos.filter((f) => f.status === 'aguarda_inspecao').length,
    inspecao:   todosAtivos.filter((f) => f.status === 'em_inspecao').length,
    tratamento: todosAtivos.filter((f) => f.status === 'em_tratamento' || f.status === 'confirmado').length,
    resolvidos: todosAtivos.filter((f) => f.status === 'resolvido').length,
  }), [todosAtivos]);

  const minhaFila = useMemo(() => {
    let list = statusChip === 'todos'
      ? todosAtivos.filter((f) => ACTIVE_STATUSES.includes(f.status as FocoRiscoStatus))
      : todosAtivos.filter((f) => f.status === statusChip);

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter((f) =>
        (f.endereco_normalizado ?? '').toLowerCase().includes(q) ||
        (f.bairro ?? '').toLowerCase().includes(q) ||
        (f.regiao_nome ?? '').toLowerCase().includes(q) ||
        (f.origem_item ?? '').toLowerCase().includes(q)
      );
    }

    // Ordenação: P1 > P2 > P3 > P4 > P5
    const ORDER_P: Record<string, number> = { P1: 0, P2: 1, P3: 2, P4: 3, P5: 4 };
    return [...list].sort((a, b) =>
      (ORDER_P[a.prioridade ?? 'P5'] ?? 4) - (ORDER_P[b.prioridade ?? 'P5'] ?? 4)
    );
  }, [todosAtivos, statusChip, debouncedSearch]);

  const isLoading = tab === 'minha_fila' ? loadingFila : loadingAberta;

  // ── Guard ──────────────────────────────────────────────────────────────────
  if (!clienteId || !usuario?.id) {
    return (
      <div className="p-4">
        <Card className="rounded-2xl border-border shadow-sm">
          <CardContent className="py-12 text-center">
            <p className="font-semibold text-foreground">Dados do usuário não disponíveis.</p>
            <p className="text-sm text-muted-foreground mt-1">Entre em contato com o administrador.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleRefresh = async () => {
    if (tab === 'minha_fila') await refetchFila();
    else await refetchAberta();
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="px-2 py-2 pb-24 space-y-2 animate-fade-in">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-1 pt-1">
          <div>
            <h1 className="text-xl font-bold text-foreground">Minha Fila</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Focos atribuídos a você para atendimento em campo
            </p>
          </div>
          <div className="flex gap-1">
            <Button
              variant="outline" size="sm"
              className="gap-1.5 rounded-xl"
              onClick={() => navigate('/agente/levantamentos/novo-item')}
            >
              <PlusCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Novo foco</span>
            </Button>
            <Button
              variant="default" size="sm"
              className="gap-1.5 rounded-xl"
              onClick={() => navigate('/agente/mapa')}
            >
              <Map className="h-4 w-4" />
              <span className="hidden sm:inline">Mapa</span>
            </Button>
          </div>
        </div>

        {/* ── KPI cards ──────────────────────────────────────────────────── */}
        {!loadingFila && (
          <div className="grid grid-cols-4 gap-1.5">
            {([
              { label: 'Aguardando', value: counts.aguarda,    color: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-950/20',   chip: 'aguarda_inspecao' as StatusChip },
              { label: 'Inspeção',   value: counts.inspecao,   color: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-950/20',     chip: 'em_inspecao' as StatusChip },
              { label: 'Tratamento', value: counts.tratamento, color: 'text-purple-600',  bg: 'bg-purple-50 dark:bg-purple-950/20', chip: 'em_tratamento' as StatusChip },
              { label: 'Resolvidos', value: counts.resolvidos, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/20', chip: 'resolvido' as StatusChip },
            ] as const).map(({ label, value, color, bg, chip }) => (
              <button
                key={chip}
                type="button"
                onClick={() => { setTab('minha_fila'); setStatusChip((prev) => prev === chip ? 'todos' : chip); }}
                className={cn(
                  'flex flex-col items-center gap-0.5 rounded-2xl border-2 border-transparent px-1 py-2.5 transition-all active:scale-95',
                  bg,
                  statusChip === chip && 'ring-2 ring-offset-1 ring-current'
                )}
              >
                <span className={cn('text-2xl font-bold leading-none', color)}>{value}</span>
                <span className={cn('text-[10px] font-medium leading-tight text-center', color)}>{label}</span>
              </button>
            ))}
          </div>
        )}

        {/* ── Abas: Minha Fila | Fila Aberta ─────────────────────────────── */}
        <div className="flex gap-0 rounded-xl border border-border overflow-hidden bg-muted/30">
          <button
            type="button"
            onClick={() => setTab('minha_fila')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-colors',
              tab === 'minha_fila'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <ListTodo className="w-4 h-4" />
            Minha Fila
            {counts.aguarda + counts.inspecao + counts.tratamento > 0 && (
              <span className={cn(
                'rounded-full px-1.5 py-0 text-[10px] font-bold',
                tab === 'minha_fila' ? 'bg-white/20' : 'bg-muted'
              )}>
                {counts.aguarda + counts.inspecao + counts.tratamento}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab('fila_aberta')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-colors',
              tab === 'fila_aberta'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Users className="w-4 h-4" />
            Fila Aberta
            {tab === 'fila_aberta' && filaAberta.length > 0 && (
              <span className="rounded-full px-1.5 py-0 text-[10px] font-bold bg-white/20">
                {filaAberta.length}
              </span>
            )}
          </button>
        </div>

        {/* ── Filtros — só na aba Minha Fila ─────────────────────────────── */}
        {tab === 'minha_fila' && (
          <div className="space-y-1.5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por endereço, bairro ou tipo..."
                className="pl-10 h-10 rounded-xl border-border bg-muted/30"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {STATUS_CHIPS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatusChip(key)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition-all',
                    statusChip === key
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-muted-foreground/40'
                  )}
                >
                  {label}
                  {key !== 'todos' && (
                    <span className={cn(
                      'ml-1 rounded-full px-1 text-[10px] font-bold',
                      statusChip === key ? 'bg-white/20' : 'bg-muted'
                    )}>
                      {key === 'aguarda_inspecao' ? counts.aguarda
                       : key === 'em_inspecao'    ? counts.inspecao
                       : key === 'em_tratamento'  ? counts.tratamento
                       : counts.resolvidos}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Loading ─────────────────────────────────────────────────────── */}
        {isLoading ? (
          <Card className="rounded-2xl border-border">
            <CardContent className="flex flex-col items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <p className="text-sm text-muted-foreground">Carregando focos...</p>
            </CardContent>
          </Card>
        ) : tab === 'minha_fila' ? (
          /* ── Lista: Minha Fila ─────────────────────────────────────────── */
          minhaFila.length === 0 ? (
            <Card className="rounded-2xl border-border">
              <CardContent className="flex flex-col items-center justify-center py-10 px-4">
                <ListTodo className="w-12 h-12 mb-3 text-muted-foreground/30" />
                <p className="text-sm font-semibold text-foreground text-center">
                  {todosAtivos.length === 0
                    ? 'Nenhum foco atribuído a você no momento.'
                    : `Nenhum foco com status "${STATUS_CHIPS.find((c) => c.key === statusChip)?.label}".`}
                </p>
                <p className="text-xs text-muted-foreground mt-1 text-center">
                  {todosAtivos.length === 0
                    ? 'Verifique a Fila Aberta para assumir focos disponíveis.'
                    : 'Tente outro filtro de status.'}
                </p>
                {todosAtivos.length === 0 && (
                  <Button
                    variant="outline" size="sm"
                    className="mt-3 rounded-xl"
                    onClick={() => setTab('fila_aberta')}
                  >
                    <Users className="w-4 h-4 mr-1.5" />
                    Ver Fila Aberta
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                {minhaFila.length} foco{minhaFila.length !== 1 ? 's' : ''}
              </p>
              {minhaFila.map((foco) => (
                <FocoCard
                  key={foco.id}
                  foco={foco}
                  agenteId={usuario?.id}
                  onNavigate={() => navigate(`/agente/focos/${foco.id}`)}
                  onAcaoRapida={(statusNovo) => {
                    if (statusNovo === 'em_inspecao') {
                      navigate(`/agente/focos/${foco.id}`);
                    } else if (statusNovo === 'confirmado') {
                      const base = foco.imovel_id
                        ? `/agente/vistoria/${foco.imovel_id}`
                        : '/agente/vistoria';
                      navigate(`${base}?focoId=${foco.id}&atividade=pesquisa`);
                    } else {
                      transitionMutation.mutate({ focoId: foco.id, statusNovo });
                    }
                  }}
                  isPending={transitionMutation.isPending || lockedFocos.has(foco.id)}
                />
              ))}
            </div>
          )
        ) : (
          /* ── Lista: Fila Aberta ────────────────────────────────────────── */
          filaAberta.length === 0 ? (
            <Card className="rounded-2xl border-border">
              <CardContent className="flex flex-col items-center justify-center py-10 px-4">
                <Users className="w-12 h-12 mb-3 text-muted-foreground/30" />
                <p className="text-sm font-semibold text-foreground text-center">
                  Nenhum foco disponível no momento.
                </p>
                <p className="text-xs text-muted-foreground mt-1 text-center">
                  Todos os focos já foram assumidos ou ainda não foram criados.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 px-1">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                  {filaAberta.length} foco{filaAberta.length !== 1 ? 's' : ''} aguardando um responsável
                </p>
              </div>
              {filaAberta.map((foco) => (
                <FocoCard
                  key={foco.id}
                  foco={foco}
                  agenteId={usuario?.id}
                  onNavigate={() => navigate(`/agente/focos/${foco.id}`)}
                  onAssumir={() => claimMutation.mutate(foco.id)}
                  isPending={claimMutation.isPending}
                  modoFila
                />
              ))}
            </div>
          )
        )}

        {/* ── Botão de refresh manual ─────────────────────────────────────── */}
        {!isLoading && (
          <div className="flex justify-center pt-1">
            <Button
              variant="ghost" size="sm"
              className="gap-1.5 text-xs text-muted-foreground rounded-xl"
              onClick={handleRefresh}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Atualizar
            </Button>
          </div>
        )}
      </div>
    </PullToRefresh>
  );
};

// ── Card de foco ──────────────────────────────────────────────────────────────

interface FocoCardProps {
  foco:        FocoRiscoAtivo;
  onNavigate:  () => void;
  onAcaoRapida?: (statusNovo: FocoRiscoStatus) => void;
  onAssumir?:  () => void;
  isPending:   boolean;
  modoFila?:   boolean;
  agenteId?:   string;
}

function FocoCard({ foco, onNavigate, onAcaoRapida, onAssumir, isPending, modoFila, agenteId }: FocoCardProps) {
  const acao = ACAO_RAPIDA[foco.status as FocoRiscoStatus];
  const endereco = foco.endereco_normalizado
    ?? [foco.logradouro, foco.numero].filter(Boolean).join(', ')
    ?? '— endereço não informado';

  const [rascunhoInfo, setRascunhoInfo] = useState<{ existe: boolean; savedAt?: string }>({ existe: false });
  useEffect(() => {
    if (!foco.imovel_id || !agenteId) return;
    carregarRascunho(foco.imovel_id, agenteId).then((r) => {
      if (r) setRascunhoInfo({ existe: true, savedAt: r.savedAt });
    });
  }, [foco.imovel_id, agenteId]);

  return (
    <Card
      className={cn(
        'rounded-2xl border-2 border-border shadow-sm overflow-hidden',
        BORDA_PRIORIDADE[foco.prioridade ?? 'P5'] ?? ''
      )}
    >
      <CardContent className="px-3 py-2.5 space-y-2">

        {/* Linha 1: badges + prioridade */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <StatusBadge status={foco.status as FocoRiscoStatus} />
            <PrioridadeBadge prioridade={foco.prioridade} />
            {foco.sla_status && foco.sla_status !== 'sem_sla' && (
              <SlaBadge slaStatus={foco.sla_status} prazoEm={foco.sla_prazo_em} />
            )}
          </div>
          <button
            type="button"
            onClick={onNavigate}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Ver detalhes"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Linha 2: endereço */}
        <div className="flex items-start gap-1.5">
          <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground leading-tight truncate">
                {endereco}
              </p>
              {foco.codigo_foco && (
                <span className="shrink-0 text-[10px] font-mono font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  #{foco.codigo_foco}
                </span>
              )}
            </div>
            {(foco.bairro ?? foco.regiao_nome) && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {[foco.bairro, foco.regiao_nome].filter(Boolean).join(' · ')}
              </p>
            )}
            {rascunhoInfo.existe && (
              <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                <Pencil className="w-2.5 h-2.5" />
                Rascunho salvo {rascunhoInfo.savedAt ? formatarTempoRascunho(rascunhoInfo.savedAt) : ''}
              </span>
            )}
          </div>
        </div>

        {/* Linha 3: ações */}
        <div className="flex gap-1.5">
          {modoFila ? (
            <>
              <Button
                size="sm"
                className="flex-1 h-8 rounded-xl text-xs font-semibold bg-primary"
                onClick={onAssumir}
                disabled={isPending}
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Assumir foco'}
              </Button>
              <Button
                size="sm" variant="outline"
                className="h-8 rounded-xl text-xs"
                onClick={onNavigate}
              >
                Ver
              </Button>
            </>
          ) : (
            <>
              {acao && onAcaoRapida && (
                <Button
                  size="sm"
                  className={cn('flex-1 h-8 rounded-xl text-xs font-semibold', acao.cor)}
                  onClick={() => onAcaoRapida(acao.proximo)}
                  disabled={isPending}
                >
                  {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : acao.label}
                </Button>
              )}
              <Button
                size="sm" variant="outline"
                className="h-8 rounded-xl text-xs"
                onClick={onNavigate}
              >
                Detalhes
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default AgenteLevantamentos;
