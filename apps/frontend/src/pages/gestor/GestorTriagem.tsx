import { useState, useMemo, useEffect } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Filter, ChevronRight, ChevronLeft, Loader2, Bot, User, MapPin, Building2,
  CheckSquare, Square, X, Users, AlertTriangle, Eye, ClipboardList, PlayCircle,
  Radio, MessageSquare, CloudRain, Edit2, Camera, Calendar as CalendarIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { useFocosRisco, useAtualizarStatusFoco, useFocoRiscoTimeline, useAtualizarClassificacaoFoco } from '@/hooks/queries/useFocosRisco';
import { useRegioes } from '@/hooks/queries/useRegioes';
import { StatusBadge } from '@/components/foco/StatusBadge';
import { PrioridadeBadge } from '@/components/foco/PrioridadeBadge';
import { SlaBadge } from '@/components/foco/SlaBadge';
import { OrigemIcone } from '@/components/foco/OrigemIcone';
import { LABEL_STATUS } from '@/types/focoRisco';
import { getTransicoesPermitidas } from '@/lib/transicoesFoco';
import { TriagemFocoImagemComYolo } from '@/components/gestor/TriagemFocoImagemComYolo';
import { TriagemTerritorial } from '@/components/gestor/TriagemTerritorial';
import { labelContaUsuario, labelResponsavelFoco } from '@/lib/usuarioLabel';
import { ClassificacaoBadge } from '@/components/foco/ClassificacaoBadge';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import { logEvento } from '@/lib/pilotoEventos';
import type { FocoRiscoStatus, FocoRiscoPrioridade, FocoRiscoOrigem, FocoRiscoAtivo, FocoRiscoClassificacao } from '@/types/database';
import { LABEL_CLASSIFICACAO_INICIAL } from '@/types/database';

type FiltroStatus = 'todos' | 'suspeita' | 'em_triagem' | 'aguarda_inspecao';
type FiltroPrioridade = 'todos' | FocoRiscoPrioridade;
type FiltroOrigem = 'todos' | FocoRiscoOrigem;
type FiltroClassificacao = 'todos' | FocoRiscoClassificacao;

// Supervisores não executam transições — apenas atribuem e reatribuem via rpc_atribuir_agente_foco
const TRANSICOES_TRIAGEM: FocoRiscoStatus[] = [];

const BORDER_PRIORIDADE: Record<string, string> = {
  P1: 'border-l-[3px] border-l-red-500',
  P2: 'border-l-[3px] border-l-orange-400',
  P3: 'border-l-[3px] border-l-amber-400',
  P4: 'border-l-[3px] border-l-blue-400',
  P5: 'border-l-[3px] border-l-slate-400',
};

/** yyyy-MM-dd armazenado no estado → Date em fuso local (evita desvio ao exibir no calendário). */
function ymdToLocalDate(s: string): Date | undefined {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? undefined : dt;
}

function startLocalDayFromYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function endLocalDayFromYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setHours(23, 59, 59, 999);
  return dt;
}

function TriagemFiltroDataButton({
  placeholderLabel,
  valueYmd,
  onChangeYmd,
}: {
  placeholderLabel: string;
  valueYmd: string;
  onChangeYmd: (ymd: string) => void;
}) {
  const selected = ymdToLocalDate(valueYmd);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            'h-8 min-w-0 flex-1 justify-start px-2 text-left font-normal text-xs rounded-sm',
            !valueYmd && 'text-muted-foreground',
          )}
        >
          <CalendarIcon className="mr-1 h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
          <span className="truncate">{selected ? format(selected, 'dd/MM/yyyy', { locale: ptBR }) : placeholderLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => onChangeYmd(d ? format(d, 'yyyy-MM-dd') : '')}
          locale={ptBR}
          initialFocus
        />
        {valueYmd ? (
          <div className="border-t border-border p-1.5">
            <Button type="button" variant="ghost" size="sm" className="h-8 w-full text-xs" onClick={() => onChangeYmd('')}>
              Limpar
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

// ── Sheet lateral de detalhe de triagem ──────────────────────────────────────

function TriagemSheet({
  foco,
  clienteId,
  selecionados,
  onClose,
}: {
  foco: FocoRiscoAtivo | null;
  clienteId: string | null | undefined;
  /** Se o foco aberto estiver neste conjunto, atribuir responsável a todos os selecionados. */
  selecionados: Set<string>;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const atualizarClassificacao = useAtualizarClassificacaoFoco();

  const { data: focoAtivo } = useQuery({
    queryKey: ['foco_risco_ativo_sheet', foco?.id],
    queryFn: () => api.focosRisco.getAtivoById(foco!.id),
    enabled: !!foco?.id,
    staleTime: STALE.SHORT,
  });

  const displayFoco = useMemo(() => {
    if (!foco) return null;
    if (!focoAtivo) return foco;
    return { ...foco, ...focoAtivo };
  }, [foco, focoAtivo]);

  const { data: timeline = [] } = useFocoRiscoTimeline(displayFoco?.id);

  const { data: itemOrigem } = useQuery({
    queryKey: ['item_levantamento_id', displayFoco?.origem_levantamento_item_id],
    queryFn: () => api.itens.getById(displayFoco!.origem_levantamento_item_id!),
    enabled: !!displayFoco?.origem_levantamento_item_id && displayFoco?.origem_tipo === 'drone',
    staleTime: STALE.LONG,
  });
  const levantamentoId = itemOrigem?.levantamento_id ?? null;

  const { data: analiseIa } = useQuery({
    queryKey: ['analise_ia_triagem', levantamentoId],
    queryFn: () => api.analiseIa.getByLevantamento(levantamentoId!),
    enabled: !!levantamentoId,
    staleTime: STALE.LONG,
  });

  const { data: agentes = [], isPending: agentesLoading, isError: agentesErro } = useQuery({
    queryKey: ['usuarios_cliente_agentes', clienteId],
    queryFn: async () => {
      try {
        return await api.usuarios.listAgentes(clienteId!);
      } catch {
        return [];
      }
    },
    enabled: !!clienteId,
    staleTime: STALE.STATIC,
  });

  const opcoesResponsavel = useMemo(
    () =>
      [...agentes].sort((a, b) =>
        (a.nome ?? a.email ?? '').localeCompare(b.nome ?? b.email ?? '', 'pt-BR', { sensitivity: 'base' })
      ),
    [agentes]
  );

  const responsavelIdValidoNoSelect =
    displayFoco?.responsavel_id && agentes.some((a) => a.id === displayFoco.responsavel_id)
      ? displayFoco.responsavel_id
      : undefined;

  const atribuirResponsavel = useMutation({
    mutationFn: async (responsavelId: string) => {
      if (!displayFoco) throw new Error('Sem foco');
      const idsAlvo =
        selecionados.size > 0 && selecionados.has(displayFoco.id)
          ? [...selecionados]
          : [displayFoco.id];
      // Usa rpc_atribuir_agente_foco_lote para auditoria + transição de estado correta.
      // em_triagem → aguarda_inspecao; aguarda_inspecao → reatribuição sem mudança de status.
      if (idsAlvo.length === 1) {
        await api.focosRisco.atribuirAgente(idsAlvo[0], responsavelId, 'Atribuição pelo supervisor via triagem');
      } else {
        await api.focosRisco.atribuirAgenteLote(idsAlvo, responsavelId, 'Atribuição em lote pelo supervisor via triagem');
      }
      return idsAlvo.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ['focos_risco'] });
      qc.invalidateQueries({ queryKey: ['focos_risco_triagem_kpis'], exact: false });
      toast.success(
        n > 1 ? `Agente atribuído a ${n} focos.` : 'Agente atribuído.'
      );
    },
    onError: (err) => {
      const msg = (err as { message?: string })?.message;
      toast.error(msg || 'Erro ao atribuir agente.');
    },
  });

  if (!displayFoco) return null;

  return (
    <Sheet open={!!foco} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto space-y-5 pb-10">
        <SheetHeader>
          <SheetTitle className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
            <StatusBadge status={displayFoco.status as FocoRiscoStatus} className="rounded-sm" />
            <PrioridadeBadge prioridade={displayFoco.prioridade} className="rounded-sm" />
          </SheetTitle>
        </SheetHeader>

        <section className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5" /> Imóvel
          </p>
          <div className="rounded-sm border border-border/60 p-3 space-y-1 text-sm">
            <p className="font-semibold">{displayFoco.logradouro ?? displayFoco.bairro ?? displayFoco.endereco_normalizado ?? 'Endereço não informado'}</p>
            {displayFoco.bairro && <p className="text-muted-foreground">{displayFoco.bairro}{displayFoco.quarteirao ? ` · Qd. ${displayFoco.quarteirao}` : ''}</p>}
            {displayFoco.tipo_imovel && <p className="text-muted-foreground capitalize">{displayFoco.tipo_imovel.replace(/_/g, ' ')}</p>}
          </div>
        </section>

        {displayFoco.origem_tipo === 'drone' && (
          <section className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5" /> Análise IA
            </p>
            {!displayFoco.origem_levantamento_item_id ? (
              <p className="text-xs text-muted-foreground">Sem item de origem vinculado.</p>
            ) : !levantamentoId ? (
              <p className="text-xs text-muted-foreground">Buscando levantamento…</p>
            ) : !analiseIa ? (
              <p className="text-xs text-muted-foreground">Análise IA ainda não gerada para este levantamento.</p>
            ) : (
              <div className="rounded-sm border border-border/60 p-3 space-y-2 text-sm">
                <p className="text-foreground">{analiseIa.sumario}</p>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>Focos detectados: <strong>{analiseIa.total_focos}</strong></span>
                  {analiseIa.clusters && (
                    <span>Clusters: <strong>{(analiseIa.clusters as unknown[]).length}</strong></span>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        <section className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" /> Agente responsável
          </Label>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Apenas contas com papel <strong className="font-medium text-foreground/80">agente</strong> (agente de campo). O e-mail identifica a conta.
          </p>
          {selecionados.size > 1 && selecionados.has(displayFoco.id) && (
            <p className="text-[11px] font-medium text-primary">
              {selecionados.size} focos selecionados na lista: o agente será atribuído a <strong>todos</strong> eles.
            </p>
          )}
          {displayFoco.responsavel_id && !responsavelIdValidoNoSelect && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              O responsável atual não tem papel agente. Escolha um agente de campo abaixo para corrigir.
            </p>
          )}
          <Select
            value={responsavelIdValidoNoSelect}
            onValueChange={(v) => atribuirResponsavel.mutate(v)}
            disabled={atribuirResponsavel.isPending || agentesLoading}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Selecionar agente…" />
            </SelectTrigger>
            {/* z-index acima do Sheet (z-[2000]); senão o dropdown fica atrás do painel e parece vazio */}
            <SelectContent position="popper" className="z-[2100]">
              {opcoesResponsavel.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {labelContaUsuario(u)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {agentesErro && (
            <p className="text-xs text-destructive">Não foi possível carregar agentes do cliente.</p>
          )}
          {!agentesLoading && !agentesErro && agentes.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Nenhum usuário com papel agente neste cliente. Cadastre um agente em Cadastros → Usuários.
            </p>
          )}
        </section>

        <section className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Classificação inicial
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {(['suspeito', 'risco', 'foco', 'caso_notificado'] as FocoRiscoClassificacao[]).map((c) => {
              const isCurrent = displayFoco?.classificacao_inicial === c;
              return (
                <button
                  key={c}
                  disabled={atualizarClassificacao.isPending}
                  onClick={async () => {
                    if (!displayFoco || isCurrent) return;
                    const res = await atualizarClassificacao.mutateAsync({
                      focoId: displayFoco.id,
                      classificacao: c,
                    });
                    if (!res.ok) toast.error(res.error ?? 'Erro ao atualizar classificação.');
                    else toast.success('Classificação atualizada.');
                  }}
                  className={`px-2.5 py-1 rounded-sm text-xs font-semibold border transition-all ${
                    isCurrent
                      ? 'ring-2 ring-primary ring-offset-1 border-primary opacity-100'
                      : 'border-border opacity-60 hover:opacity-100'
                  }`}
                >
                  {LABEL_CLASSIFICACAO_INICIAL[c]}
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" /> Histórico recente
          </p>
          {timeline.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum evento registrado.</p>
          ) : (
            <div className="space-y-2">
              {timeline.slice(0, 3).map((ev, i) => (
                <div key={i} className="flex gap-2.5 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium leading-snug">{ev.titulo}</p>
                    {ev.ts && (
                      <p className="text-xs text-muted-foreground">
                        {new Date(ev.ts).toLocaleString('pt-BR')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </SheetContent>
    </Sheet>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function GestorTriagem() {
  const navigate = useNavigate();
  const { clienteId } = useClienteAtivo();
  const qc = useQueryClient();

  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');
  const [filtroPrioridade, setFiltroPrioridade] = useState<FiltroPrioridade>('todos');
  const [filtroOrigem, setFiltroOrigem] = useState<FiltroOrigem>('todos');
  const [filtroClassificacao, setFiltroClassificacao] = useState<FiltroClassificacao>('todos');
  const [filtroRegiao, setFiltroRegiao] = useState<string>('todos');
  // '__sem__' = IS NULL (sem agente); outros valores = UUID do agente
  const [filtroResponsavel, setFiltroResponsavel] = useState<string>('todos');
  const [filtroDataDe, setFiltroDataDe] = useState<string>('');
  const [filtroDataAte, setFiltroDataAte] = useState<string>('');
  const [ordenacao, setOrdenacao] = useState<'suspeita_em_asc' | 'suspeita_em_desc' | 'score_prioridade_desc'>('suspeita_em_asc');

  const [focoSheet, setFocoSheet] = useState<FocoRiscoAtivo | null>(null);
  const [transDialog, setTransDialog] = useState<{ focoId: string; status: FocoRiscoStatus } | null>(null);
  const [motivo, setMotivo] = useState('');
  const [imagemLightbox, setImagemLightbox] = useState<{
    imageUrl: string;
    itemId: string | null;
    prioridade: FocoRiscoPrioridade | null;
  } | null>(null);

  const [modoViz, setModoViz] = useState<'item' | 'territorio'>('item');

  const { data: regioes = [] } = useRegioes(clienteId);

  // Instrumentação: triagem aberta
  useEffect(() => {
    if (clienteId) logEvento('triagem_aberta', clienteId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  function handleSetModoViz(modo: 'item' | 'territorio') {
    setModoViz(modo);
    logEvento('triagem_modo_alternado', clienteId, { modo });
  }

  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [loteAgente, setLoteAgente] = useState<string>('');
  const [loteStatusDialog, setLoteStatusDialog] = useState<FocoRiscoStatus | null>(null);
  const [loteMotivo, setLoteMotivo] = useState('');
  const [loteLoading, setLoteLoading] = useState(false);

  /** Inclui aguarda_inspecao na fila “Todos” (próximo passo após triagem). */
  /** Inclui em_inspecao na fila "Todos" — agentes em campo são visíveis ao supervisor. */
  const statusFiltro: FocoRiscoStatus[] =
    filtroStatus === 'todos'
      ? ['suspeita', 'em_triagem', 'aguarda_inspecao', 'em_inspecao']
      : [filtroStatus];

  const PAGE_SIZE = 30;
  const [page, setPage] = useState(1);

  const filtrosLista = useMemo(
    () => ({
      status: statusFiltro,
      prioridade: filtroPrioridade !== 'todos' ? [filtroPrioridade] : undefined,
      origem_tipo: filtroOrigem !== 'todos' ? filtroOrigem : undefined,
      classificacao_inicial: filtroClassificacao !== 'todos' ? filtroClassificacao as FocoRiscoClassificacao : undefined,
      regiao_id: filtroRegiao !== 'todos' ? filtroRegiao : undefined,
      responsavel_id: filtroResponsavel !== 'todos' && filtroResponsavel !== '__sem__' ? filtroResponsavel : undefined,
      semResponsavel: filtroResponsavel === '__sem__' ? true : undefined,
      de: filtroDataDe ? startLocalDayFromYmd(filtroDataDe) : undefined,
      ate: filtroDataAte ? endLocalDayFromYmd(filtroDataAte) : undefined,
      orderBy: ordenacao,
      page,
      pageSize: PAGE_SIZE,
    }),
    [statusFiltro, filtroPrioridade, filtroOrigem, filtroClassificacao, filtroRegiao, filtroResponsavel, filtroDataDe, filtroDataAte, ordenacao, page],
  );

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useFocosRisco(clienteId, filtrosLista);

  const { data: kpisTriagem, isLoading: kpisLoading } = useQuery({
    queryKey: [
      'focos_risco_triagem_kpis',
      clienteId,
      statusFiltro.join(','),
      filtroPrioridade,
      filtroOrigem,
      filtroRegiao,
      filtroResponsavel,
      filtroDataDe,
      filtroDataAte,
    ],
    queryFn: () =>
      api.focosRisco.contagemTriagemFila(clienteId!, {
        status: statusFiltro,
        prioridade: filtroPrioridade !== 'todos' ? [filtroPrioridade] : undefined,
        origem_tipo: filtroOrigem !== 'todos' ? filtroOrigem : undefined,
        regiao_id: filtroRegiao !== 'todos' ? filtroRegiao : undefined,
        responsavel_id: filtroResponsavel !== 'todos' && filtroResponsavel !== '__sem__' ? filtroResponsavel : undefined,
        semResponsavel: filtroResponsavel === '__sem__' ? true : undefined,
        de: filtroDataDe ? startLocalDayFromYmd(filtroDataDe) : undefined,
        ate: filtroDataAte ? endLocalDayFromYmd(filtroDataAte) : undefined,
      }),
    enabled: !!clienteId,
    staleTime: STALE.SHORT,
  });

  useEffect(() => {
    setPage(1);
    setSelecionados(new Set());
  }, [filtroStatus, filtroPrioridade, filtroOrigem, filtroClassificacao, filtroRegiao, filtroResponsavel, filtroDataDe, filtroDataAte, ordenacao]);

  useEffect(() => {
    // Avisa visualmente ao trocar página com seleção ativa — não bloqueia, só informa.
    if (selecionados.size > 0) {
      setSelecionados(new Set());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const atualizar = useAtualizarStatusFoco();

  const focos = data?.data ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE) || 1);

  const suspeitas = kpisTriagem?.suspeita ?? 0;
  const emTriagem = kpisTriagem?.em_triagem ?? 0;
  const aguardaInspecao = kpisTriagem?.aguarda_inspecao ?? 0;
  const emInspecao = kpisTriagem?.em_inspecao ?? 0;
  const p1p2 = kpisTriagem?.p1p2 ?? 0;
  const semResponsavel = kpisTriagem?.sem_responsavel ?? 0;

  const { data: agentes = [] } = useQuery({
    queryKey: ['usuarios_cliente_agentes', clienteId],
    queryFn: async () => {
      try {
        return await api.usuarios.listAgentes(clienteId!);
      } catch {
        return [];
      }
    },
    enabled: !!clienteId,
    staleTime: STALE.STATIC,
  });

  const { data: usuariosCliente = [] } = useQuery({
    queryKey: ['usuarios_cliente', clienteId],
    queryFn: () => api.usuarios.listByCliente(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.STATIC,
  });

  const usuarioPorId = useMemo(() => {
    const m = new Map<string, { nome?: string | null; email?: string | null }>();
    for (const u of usuariosCliente) {
      m.set(u.id, { nome: u.nome, email: u.email });
    }
    return m;
  }, [usuariosCliente]);

  // União (não interseção): mostra todos os destinos possíveis para ao menos 1 foco selecionado.
  // Focos que não podem fazer a transição são pulados silenciosamente em confirmarStatusEmLote.
  const transicoesLote = useMemo<FocoRiscoStatus[]>(() => {
    if (selecionados.size === 0) return [];
    const focosSel = focos.filter((f) => selecionados.has(f.id));
    if (focosSel.length === 0) return [];
    const union = new Set<FocoRiscoStatus>();
    for (const f of focosSel) {
      for (const t of getTransicoesPermitidas(f.status as FocoRiscoStatus)) {
        if (TRANSICOES_TRIAGEM.includes(t)) union.add(t);
      }
    }
    // Supervisores não têm transições diretas; transicoesLote sempre vazia
    const ordem: FocoRiscoStatus[] = [];
    return ordem.filter((t) => union.has(t));
  }, [selecionados, focos]);

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
      selecionados.size === focos.length ? new Set() : new Set(focos.map((f) => f.id))
    );
  }

  function limparSelecao() {
    setSelecionados(new Set());
    setLoteAgente('');
  }

  function limparFiltros() {
    setFiltroStatus('todos');
    setFiltroPrioridade('todos');
    setFiltroOrigem('todos');
    setFiltroClassificacao('todos');
    setFiltroRegiao('todos');
    setFiltroResponsavel('todos');
    setFiltroDataDe('');
    setFiltroDataAte('');
    setOrdenacao('suspeita_em_asc');
  }

  async function atribuirAgenteEmLote(responsavelId: string) {
    if (selecionados.size === 0) return;
    // Só distribui focos que estão em estados atribuíveis pelo supervisor
    const atribuiveis = focos.filter(
      (f) => selecionados.has(f.id) && ['em_triagem', 'aguarda_inspecao'].includes(f.status),
    );
    const naoElegiveis = selecionados.size - atribuiveis.length;
    if (atribuiveis.length === 0) {
      toast.error(
        `Nenhum dos ${selecionados.size} foco(s) selecionado(s) está em estado atribuível. ` +
        `Apenas focos em "Em triagem" ou "Aguarda inspeção" podem ser despachados.`,
      );
      return;
    }
    const agenteNome = agentes.find((a) => a.id === responsavelId)?.nome ?? agentes.find((a) => a.id === responsavelId)?.email ?? responsavelId;
    setLoteLoading(true);
    try {
      // Usa rpc_atribuir_agente_foco_lote — atômica, com auditoria em foco_risco_historico.
      const resultado = await api.focosRisco.atribuirAgenteLote(
        atribuiveis.map((f) => f.id),
        responsavelId,
        'Distribuição em lote pelo supervisor',
      );
      qc.invalidateQueries({ queryKey: ['focos_risco'] });
      qc.invalidateQueries({ queryKey: ['focos_risco_triagem_kpis'], exact: false });
      const ignoradosBanco = resultado?.ignorados ?? 0;
      const atribuidos = resultado?.atribuidos ?? atribuiveis.length;
      const partes: string[] = [`${atribuidos} foco(s) → ${agenteNome}`];
      if (naoElegiveis > 0) partes.push(`${naoElegiveis} estado incompatível`);
      if (ignoradosBanco > 0) partes.push(`${ignoradosBanco} recusado(s) pelo banco`);
      logEvento('despacho_lote', clienteId, {
        quantidade: atribuidos,
        ignorados: naoElegiveis + ignoradosBanco,
        agente_id: responsavelId,
      });
      toast.success(partes.join(' · '));
      setLoteAgente('');
      setSelecionados(new Set());
    } catch (err) {
      const msg = (err as { message?: string })?.message;
      toast.error(msg || `Falha ao atribuir ${atribuiveis.length} foco(s) para ${agenteNome}.`);
    } finally {
      setLoteLoading(false);
    }
  }

  /** Focos elegíveis para o status atualmente selecionado no dialog de lote. */
  const elegiveisPorLoteStatus = useMemo(() => {
    if (!loteStatusDialog) return [];
    return focos.filter(
      (f) =>
        selecionados.has(f.id) &&
        getTransicoesPermitidas(f.status as FocoRiscoStatus).includes(loteStatusDialog),
    );
  }, [loteStatusDialog, focos, selecionados]);

  async function confirmarStatusEmLote() {
    if (!loteStatusDialog || selecionados.size === 0) return;
    const statusAlvo = loteStatusDialog;
    if (statusAlvo === 'descartado' && !loteMotivo) {
      toast.error('Motivo obrigatório para descartar.');
      return;
    }
    // Snapshot antes de qualquer mutação — evita stale closure se focos refetchar
    const elegíveis = [...elegiveisPorLoteStatus];
    if (elegíveis.length === 0) {
      toast.error('Nenhum foco selecionado pode ser movido para esse status.');
      return;
    }
    setLoteLoading(true);
    const failed = new Set<string>();
    let ok = 0;
    // Chama a API diretamente — não usa o hook de mutação — para evitar que cada
    // onSuccess dispare invalidateQueries e cause re-renders que interferem no loop.
    for (const foco of elegíveis) {
      try {
        await api.focosRisco.transicionar(foco.id, statusAlvo, loteMotivo || undefined);
        ok++;
      } catch {
        failed.add(foco.id);
      }
    }
    // Invalida uma única vez após todas as transições
    qc.invalidateQueries({ queryKey: ['focos_risco'] });
    qc.invalidateQueries({ queryKey: ['focos_risco_triagem_kpis'], exact: false });
    setLoteLoading(false);
    setLoteStatusDialog(null);
    setLoteMotivo('');
    const pulados = selecionados.size - elegíveis.length;
    if (ok > 0) {
      const extra = pulados > 0 ? ` (${pulados} pulado(s) — status incompatível)` : '';
      toast.success(`${ok} foco(s) movidos para: ${LABEL_STATUS[statusAlvo] ?? statusAlvo}${extra}`);
    }
    if (failed.size > 0) {
      toast.error(`${failed.size} foco(s) não puderam ser atualizados — permanecem selecionados.`);
    }
    setSelecionados(failed);
  }

  async function confirmarTransicao() {
    if (!transDialog) return;
    const { focoId, status } = transDialog;
    if (status === 'descartado' && !motivo) {
      toast.error('Motivo obrigatório para descartar.');
      return;
    }
    try {
      await atualizar.mutateAsync({ focoId, statusNovo: status, motivo: motivo || undefined });
      toast.success(`Foco movido para: ${LABEL_STATUS[status] ?? status}`);
      setTransDialog(null);
      setMotivo('');
    } catch (err) {
      const msg = (err as { message?: string })?.message;
      toast.error(msg || 'Falha ao atualizar status.');
    }
  }

  const todosSelecionados = focos.length > 0 && selecionados.size === focos.length;
  const algunsSelecionados = selecionados.size > 0 && selecionados.size < focos.length;

  return (
    <div className={`p-4 lg:p-6 space-y-5 animate-fade-in ${selecionados.size > 0 ? "pb-56" : "pb-6"}`}>

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 absolute top-1">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-sm bg-primary/10 flex items-center justify-center shrink-0">
            <Filter className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground leading-tight">Fila de Triagem</h1>
            <p className="text-xs text-muted-foreground">Revise e classifique os focos pendentes</p>
          </div>
        </div>
        {total > 0 && (
          <span className="inline-flex items-center rounded-sm bg-muted px-3 py-1 text-sm font-semibold text-foreground shrink-0 mt-0.5">
            {total} foco{total !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ── KPIs (agregados no servidor, mesmos filtros da lista) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="rounded-sm bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/30">
          <CardContent className="pt-4 pb-3 text-center space-y-1">
            <Eye className="w-4 h-4 text-amber-500 mx-auto" />
            {kpisLoading ? (
              <Skeleton className="h-8 w-12 mx-auto rounded-sm" />
            ) : (
              <p className="text-2xl font-black text-foreground">{suspeitas}</p>
            )}
            <p className="text-xs text-muted-foreground">Suspeitas</p>
          </CardContent>
        </Card>
        <Card className="rounded-sm bg-blue-50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30">
          <CardContent className="pt-4 pb-3 text-center space-y-1">
            <Filter className="w-4 h-4 text-blue-500 mx-auto" />
            {kpisLoading ? (
              <Skeleton className="h-8 w-12 mx-auto rounded-sm" />
            ) : (
              <p className="text-2xl font-black text-blue-600">{emTriagem}</p>
            )}
            <p className="text-xs text-muted-foreground">Em triagem</p>
          </CardContent>
        </Card>
        <Card className="rounded-sm bg-violet-50 dark:bg-violet-950/20 border-violet-100 dark:border-violet-900/30">
          <CardContent className="pt-4 pb-3 text-center space-y-1">
            <ClipboardList className="w-4 h-4 text-violet-500 mx-auto" />
            {kpisLoading ? (
              <Skeleton className="h-8 w-12 mx-auto rounded-sm" />
            ) : (
              <p className="text-2xl font-black text-violet-700 dark:text-violet-400">{aguardaInspecao}</p>
            )}
            <p className="text-xs text-muted-foreground">Aguarda inspeção</p>
          </CardContent>
        </Card>
        <Card className="rounded-sm bg-indigo-50 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900/30">
          <CardContent className="pt-4 pb-3 text-center space-y-1">
            <PlayCircle className="w-4 h-4 text-indigo-500 mx-auto" />
            {kpisLoading ? (
              <Skeleton className="h-8 w-12 mx-auto rounded-sm" />
            ) : (
              <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{emInspecao}</p>
            )}
            <p className="text-xs text-muted-foreground">Em inspeção</p>
          </CardContent>
        </Card>
        <Card className="rounded-sm bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/30">
          <CardContent className="pt-4 pb-3 text-center space-y-1">
            <AlertTriangle className="w-4 h-4 text-red-500 mx-auto" />
            {kpisLoading ? (
              <Skeleton className="h-8 w-12 mx-auto rounded-sm" />
            ) : (
              <p className="text-2xl font-black text-red-500">{p1p2}</p>
            )}
            <p className="text-xs text-muted-foreground">Críticos P1/P2</p>
          </CardContent>
        </Card>
        <Card className="rounded-sm col-span-2 sm:col-span-1 lg:col-span-1">
          <CardContent className="pt-4 pb-3 text-center space-y-1">
            <User className="w-4 h-4 text-muted-foreground mx-auto" />
            {kpisLoading ? (
              <Skeleton className="h-8 w-12 mx-auto rounded-sm" />
            ) : (
              <p className="text-2xl font-black text-foreground">{semResponsavel}</p>
            )}
            <p className="text-xs text-muted-foreground">Sem agente</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Modo de visualização ── */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleSetModoViz('item')}
          className={`px-3 py-1.5 rounded-sm text-xs font-semibold border transition-colors ${
            modoViz === 'item'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border bg-background text-muted-foreground hover:bg-muted'
          }`}
        >
          Por item
        </button>
        <button
          type="button"
          onClick={() => handleSetModoViz('territorio')}
          className={`px-3 py-1.5 rounded-sm text-xs font-semibold border transition-colors ${
            modoViz === 'territorio'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border bg-background text-muted-foreground hover:bg-muted'
          }`}
        >
          Por território
        </button>
      </div>

      {/* ── Modo territorial ── */}
      {modoViz === 'territorio' && (
        <TriagemTerritorial clienteId={clienteId} agentes={agentes} />
      )}

      {/* ── Filtros ── */}
      {modoViz === 'item' && (<>
      <div className="rounded-sm border border-border/60 bg-muted/30 p-3 space-y-3">
        {/* Linha 1: Status · Prioridade · Origem · Classificação */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Status</p>
            <div className="flex flex-wrap gap-1.5">
              {([
                { v: 'todos',            l: 'Todos' },
                { v: 'suspeita',         l: 'Suspeita' },
                { v: 'em_triagem',       l: 'Em triagem' },
                { v: 'aguarda_inspecao', l: 'Aguardando' },
              ] as { v: FiltroStatus; l: string }[]).map(({ v, l }) => (
                <button
                  key={v}
                  onClick={() => setFiltroStatus(v)}
                  className={`px-2.5 py-1 rounded-sm text-xs font-semibold border transition-colors ${
                    filtroStatus === v
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Prioridade</p>
            <div className="flex flex-wrap gap-1.5">
              {(['todos', 'P1', 'P2', 'P3', 'P4', 'P5'] as FiltroPrioridade[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setFiltroPrioridade(p)}
                  className={`px-2.5 py-1 rounded-sm text-xs font-semibold border transition-colors ${
                    filtroPrioridade === p
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {p === 'todos' ? 'Todas' : p}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Origem</p>
            <div className="flex flex-wrap gap-1.5">
              {(['todos', 'drone', 'agente', 'cidadao', 'pluvio', 'manual'] as FiltroOrigem[]).map((o) => (
                <button
                  key={o}
                  onClick={() => setFiltroOrigem(o)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-sm text-xs font-semibold border transition-colors ${
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

          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Classificação</p>
            <div className="flex flex-wrap gap-1.5">
              {(['todos', 'suspeito', 'risco', 'foco', 'caso_notificado'] as FiltroClassificacao[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setFiltroClassificacao(c)}
                  className={`px-2.5 py-1 rounded-sm text-xs font-semibold border transition-colors ${
                    filtroClassificacao === c
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {c === 'todos' ? 'Todas' : LABEL_CLASSIFICACAO_INICIAL[c as FocoRiscoClassificacao]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Linha 2: Região · Agente · Data de entrada */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-border/40">
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Região
            </p>
            <Select value={filtroRegiao} onValueChange={setFiltroRegiao}>
              <SelectTrigger className="h-8 text-xs rounded-sm">
                <SelectValue placeholder="Todas as regiões" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as regiões</SelectItem>
                {regioes.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.regiao}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <User className="w-3 h-3" /> Agente atribuído
            </p>
            <Select value={filtroResponsavel} onValueChange={setFiltroResponsavel}>
              <SelectTrigger className="h-8 text-xs rounded-sm">
                <SelectValue placeholder="Todos os agentes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os agentes</SelectItem>
                <SelectItem value="__sem__">Sem agente atribuído</SelectItem>
                {agentes.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{labelContaUsuario(u)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Entrada</p>
            <div className="flex items-center gap-1.5 min-w-0">
              <TriagemFiltroDataButton placeholderLabel="De" valueYmd={filtroDataDe} onChangeYmd={setFiltroDataDe} />
              <span className="text-xs text-muted-foreground shrink-0">até</span>
              <TriagemFiltroDataButton placeholderLabel="Até" valueYmd={filtroDataAte} onChangeYmd={setFiltroDataAte} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-0.5 flex-wrap">
          <div className="flex items-center gap-2">
            <Select value={ordenacao} onValueChange={(v) => setOrdenacao(v as typeof ordenacao)}>
              <SelectTrigger className="h-8 text-xs w-44 rounded-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="suspeita_em_asc">Mais antigos primeiro</SelectItem>
                <SelectItem value="suspeita_em_desc">Mais recentes primeiro</SelectItem>
                <SelectItem value="score_prioridade_desc">Maior prioridade</SelectItem>
              </SelectContent>
            </Select>
            <button
              onClick={() => {
                setFiltroStatus('em_triagem');
                setFiltroResponsavel('__sem__');
              }}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-sm bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
            >
              Prontos para despacho
            </button>
          </div>
          {(filtroStatus !== 'todos' || filtroPrioridade !== 'todos' || filtroOrigem !== 'todos' ||
            filtroClassificacao !== 'todos' || filtroRegiao !== 'todos' || filtroResponsavel !== 'todos' ||
            filtroDataDe || filtroDataAte || ordenacao !== 'suspeita_em_asc') && (
            <button
              onClick={limparFiltros}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3 h-3" /> Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* ── Lista ── */}
      {isError ? (
        <Card className="rounded-sm border-destructive/40 bg-destructive/5">
          <CardContent className="py-8 flex flex-col items-center gap-3 text-center">
            <AlertTriangle className="w-8 h-8 text-destructive" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Não foi possível carregar a fila</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                {error instanceof Error ? error.message : 'Erro desconhecido.'}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-sm border border-border/60 border-l-[3px] border-l-muted p-4">
              <div className="flex gap-3 items-start">
                <Skeleton className="w-4 h-4 rounded mt-0.5 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex gap-1.5">
                    <Skeleton className="h-5 w-16 rounded-sm" />
                    <Skeleton className="h-5 w-8 rounded-sm" />
                    <Skeleton className="h-5 w-14 rounded-sm" />
                  </div>
                  <Skeleton className="h-4 w-3/4 rounded" />
                  <Skeleton className="h-3 w-1/2 rounded" />
                  <div className="flex gap-1.5 mt-1">
                    <Skeleton className="h-7 w-20 rounded" />
                    <Skeleton className="h-7 w-20 rounded" />
                  </div>
                </div>
                <Skeleton className="w-16 h-16 rounded-sm shrink-0" />
              </div>
            </div>
          ))}
        </div>
      ) : focos.length === 0 ? (
        <Card className="rounded-sm border-dashed">
          <CardContent className="py-14 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-sm bg-muted flex items-center justify-center">
              <Filter className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Nenhum foco encontrado</p>
              <p className="text-xs text-muted-foreground max-w-[220px]">
                Tente ajustar os filtros de status, prioridade ou origem.
              </p>
            </div>
            <Button variant="outline" size="sm" className="mt-1 text-xs h-8" onClick={limparFiltros}>
              Limpar filtros
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Barra de seleção */}
          <div className="flex items-center gap-3 px-1">
            <button
              onClick={toggleTodos}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {todosSelecionados ? (
                <CheckSquare className="w-4 h-4 text-primary" />
              ) : algunsSelecionados ? (
                <CheckSquare className="w-4 h-4 text-primary/50" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              {todosSelecionados ? 'Desmarcar todos' : 'Selecionar todos'}
            </button>
            <span className="text-xs text-muted-foreground">
              {total} foco(s)
              {total > 0 && (
                <span className="text-muted-foreground/80">
                  {' '}
                  · página {page}/{totalPages}
                </span>
              )}
            </span>
          </div>

          {focos.map((foco) => {
            const transicoesDisponiveis = getTransicoesPermitidas(foco.status as FocoRiscoStatus)
              .filter((t) => TRANSICOES_TRIAGEM.includes(t));
            const temIa = foco.origem_tipo === 'drone' && !!foco.origem_levantamento_item_id;
            const isSelecionado = selecionados.has(foco.id);
            const responsavelLabel = labelResponsavelFoco(foco, usuarioPorId);

            const suspeitaRelativa = foco.suspeita_em
              ? formatDistanceToNow(new Date(foco.suspeita_em), { locale: ptBR, addSuffix: true })
              : null;
            const nomeResponsavel = responsavelLabel
              ? responsavelLabel.split('·')[0].trim()
              : null;
            const showSla = foco.sla_status && foco.sla_status !== 'ok' && foco.sla_status !== 'sem_sla';

            return (
              <Card
                key={foco.id}
                className={`rounded-sm border transition-all cursor-pointer overflow-hidden ${
                  BORDER_PRIORIDADE[foco.prioridade ?? ''] ?? 'border-l-[3px] border-l-transparent'
                } ${
                  isSelecionado
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border/60 hover:border-border/80 hover:shadow-sm'
                }`}
                onClick={() => setFocoSheet(foco)}
              >
                {/* ── Corpo do card ── */}
                <CardContent className="p-3">
                  <div className="flex gap-2.5 items-start">
                    {/* Checkbox */}
                    <div className="mt-0.5 shrink-0" onClick={(e) => toggleSelecionado(foco.id, e)}>
                      <Checkbox checked={isSelecionado} />
                    </div>

                    {/* Conteúdo principal */}
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Linha 1 — status + prioridade + classificação + alertas */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={foco.status as FocoRiscoStatus} className="rounded-sm" />
                        <PrioridadeBadge prioridade={foco.prioridade} className="rounded-sm" />
                        <ClassificacaoBadge
                          classificacao={foco.classificacao_inicial as FocoRiscoClassificacao}
                          size="sm"
                          className="rounded-sm"
                        />
                        {showSla && (
                          <SlaBadge slaStatus={foco.sla_status} prazoEm={foco.sla_prazo_em} className="rounded-sm" />
                        )}
                        {temIa && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                            <Bot className="w-3 h-3" /> IA
                          </span>
                        )}
                        {/* Badge de origem — canal de entrada do foco */}
                        {(() => {
                          const cfg: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
                            cidadao: { label: 'Cidadão',  icon: MessageSquare, cls: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800' },
                            drone:   { label: 'Drone',    icon: Radio,         cls: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' },
                            agente:  { label: 'Agente',   icon: User,          cls: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800' },
                            pluvio:  { label: 'Pluvial',  icon: CloudRain,     cls: 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800' },
                            manual:  { label: 'Manual',   icon: Edit2,         cls: 'bg-muted text-muted-foreground border-border' },
                          };
                          const c = cfg[foco.origem_tipo as string];
                          if (!c) return null;
                          const Icon = c.icon;
                          return (
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border text-[10px] font-semibold ${c.cls}`}>
                              <Icon className="w-3 h-3" />
                              {c.label}
                            </span>
                          );
                        })()}
                        {!foco.tem_dados_minimos && foco.status === 'suspeita' && (
                          <span
                            title={`Dados incompletos: ${(foco.pendencias ?? []).map((p: string) => ({
                              sem_localizacao: 'sem localização',
                              sem_bairro: 'sem bairro',
                              sem_descricao: 'sem descrição',
                              sem_evidencia: 'sem evidência',
                            }[p] ?? p)).join(', ')}`}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 cursor-help"
                          >
                            <AlertTriangle className="w-3 h-3" /> Incompleto
                          </span>
                        )}
                        {foco.origem_tipo === 'cidadao' && (() => {
                          const p = foco.payload as { confirmacoes?: number; foto_url?: string } | null;
                          const confirmacoes = (p?.confirmacoes as number) ?? 1;
                          const temFoto = !!p?.foto_url;
                          return (
                            <>
                              {confirmacoes > 1 && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                                  <MessageSquare className="w-3 h-3" />{confirmacoes} denúncias
                                </span>
                              )}
                              {temFoto && (
                                <span
                                  title="Foto enviada pelo cidadão"
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[10px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400"
                                >
                                  <Camera className="w-3 h-3" />
                                </span>
                              )}
                            </>
                          );
                        })()}
                      </div>

                      {/* Linha 2 — endereço + imagem thumbnail inline */}
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground flex items-center gap-1.5 leading-tight">
                            <OrigemIcone origem={foco.origem_tipo as FocoRiscoOrigem} />
                            <span className="truncate">
                              {foco.logradouro ?? foco.bairro ?? foco.endereco_normalizado ?? 'Endereço não informado'}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {[
                              foco.bairro && foco.logradouro ? foco.bairro : null,
                              foco.quarteirao ? `Qd. ${foco.quarteirao}` : null,
                              foco.regiao_nome ? foco.regiao_nome : null,
                              foco.codigo_foco ?? null,
                            ].filter(Boolean).join(' · ')}
                          </p>
                        </div>

                        {/* Thumbnail integrada ao endereço */}
                        {foco.origem_image_url && (
                          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                            <TriagemFocoImagemComYolo
                              imageUrl={foco.origem_image_url}
                              itemId={foco.origem_levantamento_item_id ?? null}
                              prioridade={foco.prioridade}
                              variant="thumb"
                              onExpand={() =>
                                setImagemLightbox({
                                  imageUrl: foco.origem_image_url!,
                                  itemId: foco.origem_levantamento_item_id ?? null,
                                  prioridade: foco.prioridade,
                                })
                              }
                              className="!w-14 !h-14 !max-w-none p-0 rounded-sm border-border/50"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>

                {/* ── Footer — responsável · data · ações ── */}
                <div
                  className="px-3 pb-3 flex items-center gap-2 border-t border-border/40 pt-2 mt-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Responsável + data */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0 flex-1">
                    {nomeResponsavel ? (
                      <>
                        <User className="w-3 h-3 shrink-0" />
                        <span className="truncate">{nomeResponsavel}</span>
                      </>
                    ) : (
                      <span className="italic">Sem responsável</span>
                    )}
                    {suspeitaRelativa && (
                      <>
                        <span className="text-border">·</span>
                        <span className="shrink-0">{suspeitaRelativa}</span>
                      </>
                    )}
                  </div>

                  {/* Botões de transição + detalhes */}
                  <div className="flex items-center gap-1 shrink-0">
                    {transicoesDisponiveis.map((t) => {
                      const bloqueadoPorDados =
                        !foco.tem_dados_minimos &&
                        foco.status === 'suspeita' &&
                        (t === 'em_triagem' || t === 'aguarda_inspecao');
                      const pendenciasLabel = bloqueadoPorDados
                        ? `Dados incompletos: ${(foco.pendencias ?? []).map((p: string) => ({
                            sem_localizacao: 'localização',
                            sem_bairro: 'bairro',
                            sem_descricao: 'descrição',
                            sem_evidencia: 'evidência',
                          }[p] ?? p)).join(', ')}`
                        : undefined;
                      return (
                        <Button
                          key={t}
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-[11px] font-semibold"
                          disabled={atualizar.isPending || bloqueadoPorDados}
                          title={pendenciasLabel}
                          onClick={() => {
                            if (isSelecionado && selecionados.size > 1) {
                              setLoteStatusDialog(t);
                              setLoteMotivo('');
                            } else {
                              setTransDialog({ focoId: foco.id, status: t });
                              setMotivo('');
                            }
                          }}
                        >
                          {LABEL_STATUS[t] ?? t}
                        </Button>
                      );
                    })}
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 px-3 text-[11px] font-bold"
                      onClick={() => navigate(`/gestor/focos/${foco.id}`)}
                    >
                      Abrir
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}

          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums">
                Página {page} de {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Toolbar flutuante (lote) ── */}
      {selecionados.size > 0 && (() => {
        const elegiveisLote = focos.filter(
          (f) => selecionados.has(f.id) && ['em_triagem', 'aguarda_inspecao'].includes(f.status),
        );
        const naoElegiveisLote = selecionados.size - elegiveisLote.length;
        const agenteNomeLote = loteAgente
          ? (agentes.find((a) => a.id === loteAgente)?.nome ?? agentes.find((a) => a.id === loteAgente)?.email ?? null)
          : null;
        return (
          <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/98 backdrop-blur shadow-2xl">
            <div className="max-w-3xl mx-auto p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <Users className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm font-semibold">{selecionados.size} selecionado(s)</span>
                  {naoElegiveisLote > 0 ? (
                    <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 px-2 py-0.5 rounded-sm font-medium">
                      {elegiveisLote.length} elegível(is) · {naoElegiveisLote} incompatível(is)
                    </span>
                  ) : (
                    <span className="text-xs bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400 px-2 py-0.5 rounded-sm font-medium">
                      {elegiveisLote.length} pronto(s) para despacho
                    </span>
                  )}
                </div>
                <button onClick={limparSelecao} className="text-muted-foreground hover:text-foreground shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex gap-2">
                <Select value={loteAgente || undefined} onValueChange={setLoteAgente} disabled={loteLoading}>
                  <SelectTrigger className="h-9 text-sm flex-1 rounded-sm">
                    <SelectValue placeholder="Selecionar agente…" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="z-[2100]">
                    {agentes.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{labelContaUsuario(u)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="h-9 px-4 shrink-0"
                  disabled={!loteAgente || loteLoading || elegiveisLote.length === 0}
                  onClick={() => atribuirAgenteEmLote(loteAgente)}
                  title={agenteNomeLote ? `Despachar ${elegiveisLote.length} foco(s) para ${agenteNomeLote}` : undefined}
                >
                  {loteLoading
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : `Despachar${elegiveisLote.length > 0 ? ` (${elegiveisLote.length})` : ''}`}
                </Button>
              </div>

              {agenteNomeLote && elegiveisLote.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  {elegiveisLote.length} foco(s) → <strong className="text-foreground">{agenteNomeLote}</strong> · movidos para <em>Aguarda inspeção</em>
                  {naoElegiveisLote > 0 && <span className="text-amber-600 dark:text-amber-400"> · {naoElegiveisLote} serão ignorados</span>}
                </p>
              )}

              {transicoesLote.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-xs text-muted-foreground self-center">Mover para:</span>
                  {transicoesLote.map((t) => (
                    <Button
                      key={t}
                      size="sm"
                      variant="outline"
                      className="h-7 px-2.5 text-xs"
                      disabled={loteLoading}
                      onClick={() => { setLoteStatusDialog(t); setLoteMotivo(''); }}
                    >
                      {LABEL_STATUS[t] ?? t}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      </>)}

      {/* Sheet lateral */}
      <TriagemSheet
        foco={focoSheet}
        clienteId={clienteId}
        selecionados={selecionados}
        onClose={() => setFocoSheet(null)}
      />

      {/* Dialog transição individual */}
      <Dialog open={!!transDialog} onOpenChange={(v) => !v && setTransDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Mover para: {transDialog ? (LABEL_STATUS[transDialog.status] ?? transDialog.status) : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="motivo-triagem">
              Motivo {transDialog?.status === 'descartado' ? '(obrigatório)' : '(opcional)'}
            </Label>
            <Input
              id="motivo-triagem"
              placeholder="Descreva o motivo..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransDialog(null)}>Cancelar</Button>
            <Button
              onClick={confirmarTransicao}
              disabled={atualizar.isPending || (transDialog?.status === 'descartado' && !motivo)}
            >
              {atualizar.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lightbox — miniatura sem bbox; expandida com overlays YOLO */}
      <Dialog open={!!imagemLightbox} onOpenChange={(v) => !v && setImagemLightbox(null)}>
        <DialogContent className="max-w-4xl p-2 bg-black/90 border-0 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="sr-only">
            <DialogTitle>Imagem do foco</DialogTitle>
          </DialogHeader>
          {imagemLightbox && (
            <TriagemFocoImagemComYolo
              imageUrl={imagemLightbox.imageUrl}
              itemId={imagemLightbox.itemId}
              prioridade={imagemLightbox.prioridade}
              variant="dialog"
              className="[&_p]:text-neutral-300"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog transição em lote */}
      <Dialog open={!!loteStatusDialog} onOpenChange={(v) => !v && setLoteStatusDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Mover para: {loteStatusDialog ? (LABEL_STATUS[loteStatusDialog] ?? loteStatusDialog) : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {elegiveisPorLoteStatus.length < selecionados.size && (
              <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-sm px-3 py-2">
                <strong>{elegiveisPorLoteStatus.length}</strong> de {selecionados.size} foco(s) selecionados podem ser movidos para este status.
                Os demais serão ignorados (status incompatível).
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
