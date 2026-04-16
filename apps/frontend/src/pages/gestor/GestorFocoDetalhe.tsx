import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/services/api';
import { cn } from '@/lib/utils';
import { ArrowLeft, Image, Wrench, ClipboardCheck, MapPin, Check, Lock, Info, Stethoscope, UserCheck, RotateCcw, Plus, Calendar, Pencil, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useFocoRisco, useAtualizarStatusFoco, useEvidenciasFoco, useAtualizarClassificacaoFoco } from '@/hooks/queries/useFocosRisco';
import { useCruzamentosDoItem } from '@/hooks/queries/useCasosNotificados';
import { DadosMinimosPainel } from '@/components/foco/DadosMinimosPainel';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { useAgentes } from '@/hooks/queries/useAgentes';
import { getTransicoesPermitidas } from '@/lib/transicoesFoco';
import { StatusBadge } from '@/components/foco/StatusBadge';
import { PrioridadeBadge } from '@/components/foco/PrioridadeBadge';
import { SlaBadge } from '@/components/foco/SlaBadge';
import { RecorrenciaBadge } from '@/components/foco/RecorrenciaBadge';
import { FocoRiscoTimeline } from '@/components/foco/FocoRiscoTimeline';
import { ReinspecaoCard } from '@/components/foco/ReinspecaoCard';
import { ClassificacaoBadge } from '@/components/foco/ClassificacaoBadge';
import { LABEL_STATUS } from '@/types/focoRisco';
import { mapFocoToStatusOperacional, LABEL_STATUS_OPERACIONAL, type FocoStatus } from '@/lib/mapStatusOperacional';
import type { FocoRiscoStatus, FocoRiscoClassificacao } from '@/types/database';
import { LABEL_CLASSIFICACAO_INICIAL } from '@/types/database';
import { logEvento } from '@/lib/pilotoEventos';
import { getSlaReductionReason } from '@/types/sla';
import { useReinspecoesByFoco, useCriarReinspecaoMutation, useCancelarReinspecaoMutation, useReagendarReinspecaoMutation } from '@/hooks/queries/useReinspecoes';
import { useVistoriasByImovel } from '@/hooks/queries/useVistorias';
import { DimensoesBadges } from '@/components/consolidacao/DimensoesBadges';
import { PrioridadeBadge as PrioridadeConsolidacaoBadge } from '@/components/consolidacao/PrioridadeBadge';
import { ConsolidacaoAnaliticaDetalhe } from '@/components/consolidacao/ConsolidacaoAnaliticaDetalhe';
import { useModoAnalitico } from '@/hooks/useModoAnalitico';
import { useSlaInteligenteByFoco } from '@/hooks/queries/useSlaInteligente';
import {
  LABEL_STATUS_SLA_INT, LABEL_FASE_SLA, COR_STATUS_SLA_INT, formatarTempoMin,
  type SlaInteligenteStatus, type FaseSla,
} from '@/lib/slaInteligenteVisual';

// ── State machine timeline ────────────────────────────────────────────────────
const SM_MAIN_STATES: FocoRiscoStatus[] = [
  'suspeita',
  'em_triagem',
  'aguarda_inspecao',
  'confirmado',
  'em_tratamento',
  'resolvido',
];

const TERMINAL_STATES: FocoRiscoStatus[] = ['resolvido', 'descartado'];

const SM_LABELS: Record<string, string> = {
  suspeita: 'Suspeita',
  em_triagem: 'Em triagem',
  aguarda_inspecao: 'Aguarda inspeção',
  confirmado: 'Confirmado',
  em_tratamento: 'Em tratamento',
  resolvido: 'Resolvido',
  descartado: 'Descartado',
};

function StateMachineTimeline({ currentStatus }: { currentStatus: string }) {
  const isDescartado = currentStatus === 'descartado';
  const currentIdx = SM_MAIN_STATES.indexOf(currentStatus as FocoRiscoStatus);
  // If descartado, treat as if we reached "confirmado" branch then went to descartado
  const effectiveIdx = isDescartado
    ? SM_MAIN_STATES.indexOf('confirmado')
    : currentIdx;

  return (
    <div className="w-full overflow-x-auto pb-1">
      <div className="flex items-start min-w-max gap-0 px-1 py-2">
        {SM_MAIN_STATES.map((state, idx) => {
          const isPast = idx < effectiveIdx;
          const isCurrent = !isDescartado && idx === currentIdx;
          const isFuture = idx > effectiveIdx || (isDescartado && idx > SM_MAIN_STATES.indexOf('confirmado'));
          const isTerminal = TERMINAL_STATES.includes(state);
          const isConfirmedNode = state === 'confirmado';

          return (
            <div key={state} className="flex items-start">
              {/* Node */}
              <div className="flex flex-col items-center gap-1">
                <div
                  className={[
                    'w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all',
                    isCurrent
                      ? 'bg-primary border-primary text-primary-foreground shadow-md'
                      : isPast
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'bg-muted border-muted-foreground/30 text-muted-foreground',
                  ].join(' ')}
                >
                  {isPast ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : isTerminal && (isCurrent || isFuture) ? (
                    <Lock className="w-3 h-3" />
                  ) : (
                    <span className="text-[10px] font-bold">{idx + 1}</span>
                  )}
                </div>

                {/* Label */}
                <span
                  className={[
                    'text-[9px] font-medium text-center leading-tight max-w-[60px]',
                    isCurrent
                      ? 'text-primary font-bold'
                      : isPast
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-muted-foreground/60',
                  ].join(' ')}
                >
                  {SM_LABELS[state]}
                </span>

                {/* Descartado branch below "confirmado" */}
                {isConfirmedNode && (
                  <div className="flex flex-col items-center mt-1">
                    <div className="w-px h-3 bg-muted-foreground/30" />
                    <div
                      className={[
                        'w-6 h-6 rounded-full flex items-center justify-center border-2',
                        isDescartado
                          ? 'bg-destructive border-destructive text-destructive-foreground shadow-md'
                          : 'bg-muted border-muted-foreground/20 text-muted-foreground/50',
                      ].join(' ')}
                    >
                      <Lock className="w-2.5 h-2.5" />
                    </div>
                    <span
                      className={[
                        'text-[9px] font-medium text-center leading-tight max-w-[52px]',
                        isDescartado ? 'text-destructive font-bold' : 'text-muted-foreground/40',
                      ].join(' ')}
                    >
                      Descartado
                    </span>
                  </div>
                )}
              </div>

              {/* Connector line (not after last) */}
              {idx < SM_MAIN_STATES.length - 1 && (
                <div
                  className={[
                    'h-0.5 w-8 mt-3 shrink-0',
                    isPast || (isCurrent && idx < SM_MAIN_STATES.length - 1)
                      ? 'bg-green-400'
                      : 'bg-muted-foreground/20',
                  ].join(' ')}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export default function GestorFocoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { clienteId } = useClienteAtivo();
  const { data, isLoading } = useFocoRisco(id);
  const atualizar = useAtualizarStatusFoco();
  const { data: agentes } = useAgentes(clienteId);

  const [transDialog, setTransDialog] = useState<FocoRiscoStatus | null>(null);
  const [motivo, setMotivo] = useState('');
  const [responsavelSelecionado, setResponsavelSelecionado] = useState<string>('');
  const [editandoClassificacao, setEditandoClassificacao] = useState(false);
  const [atribuirDialog,         setAtribuirDialog]         = useState(false);
  const [novoResponsavelAtribuir, setNovoResponsavelAtribuir] = useState('');

  const atualizarClassificacao = useAtualizarClassificacaoFoco();

  const qc = useQueryClient();
  const atribuirMutation = useMutation({
    mutationFn: (agenteId: string) =>
      api.focosRisco.atribuirAgente(id!, agenteId),
    onSuccess: () => {
      const msg = foco?.status === 'em_triagem'
        ? 'Foco encaminhado para inspeção.'
        : 'Agente reatribuído com sucesso.';
      toast.success(msg);
      qc.invalidateQueries({ queryKey: ['foco_risco',       id] });
      qc.invalidateQueries({ queryKey: ['focos_risco',      clienteId] });
      qc.invalidateQueries({ queryKey: ['focos_atribuidos', clienteId] });
      setAtribuirDialog(false);
      setNovoResponsavelAtribuir('');
    },
    onError: (err) => {
      const msg = (err as { message?: string })?.message;
      toast.error(msg || 'Erro ao atribuir agente.');
    },
  });

  const foco = data?.foco ?? null;
  const timeline = data?.timeline ?? [];

  const { ativo: modoAnalitico } = useModoAnalitico();

  // ── Vistorias consolidadas para o imóvel deste foco ───────────────────────
  const { data: vistoriasImovel = [], isLoading: vistoriasLoading } =
    useVistoriasByImovel(foco?.imovel_id, clienteId);

  useEffect(() => {
    if (foco?.id && clienteId) {
      logEvento('foco_visualizado', clienteId, {
        foco_id: foco.id,
        status: foco.status,
        prioridade: foco.prioridade,
        score: foco.score_prioridade,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foco?.id]);

  // ── Reinspeções ──────────────────────────────────────────────────────────────
  const { data: reinspecoes = [], isLoading: reinspecoesLoading } = useReinspecoesByFoco(foco?.id);
  const criarReinspecao = useCriarReinspecaoMutation();
  const cancelarReinspecao = useCancelarReinspecaoMutation();
  const reagendarReinspecao = useReagendarReinspecaoMutation();

  const [novaReinspecaoDialog, setNovaReinspecaoDialog] = useState(false);
  const [novaDataPrevista, setNovaDataPrevista] = useState('');
  const [novoResponsavelId, setNovoResponsavelId] = useState('');
  const [reagendarDialog, setReagendarDialog] = useState<string | null>(null);
  const [reagendarData, setReagendarData] = useState('');

  async function handleCriarReinspecao() {
    if (!foco || !novaDataPrevista) return;
    try {
      const res = await criarReinspecao.mutateAsync({
        focoRiscoId: foco.id,
        dataPrevista: new Date(novaDataPrevista),
        responsavelId: novoResponsavelId || undefined,
      });
      if (res.ok) {
        toast.success('Reinspeção criada com sucesso.');
        setNovaReinspecaoDialog(false);
        setNovaDataPrevista('');
        setNovoResponsavelId('');
      } else {
        toast.error(res.error ?? 'Erro ao criar reinspeção.');
      }
    } catch {
      toast.error('Falha ao criar reinspeção.');
    }
  }

  async function handleCancelarReinspecao(reinspecaoId: string) {
    if (!foco) return;
    try {
      await cancelarReinspecao.mutateAsync({ reinspecaoId, focoRiscoId: foco.id });
      toast.success('Reinspeção cancelada.');
    } catch {
      toast.error('Falha ao cancelar reinspeção.');
    }
  }

  async function handleReagendar() {
    if (!reagendarDialog || !reagendarData || !foco) return;
    try {
      await reagendarReinspecao.mutateAsync({
        reinspecaoId: reagendarDialog,
        focoRiscoId: foco.id,
        novaData: new Date(reagendarData),
      });
      toast.success('Reinspeção reagendada.');
      setReagendarDialog(null);
      setReagendarData('');
    } catch {
      toast.error('Falha ao reagendar.');
    }
  }

  const { data: slaInt } = useSlaInteligenteByFoco(foco?.id);

  const { operacoes: opQuery, deteccao: detQuery } = useEvidenciasFoco(
    foco?.id,
    clienteId,
    foco?.origem_levantamento_item_id,
  );
  const { data: cruzamentosFoco = [] } = useCruzamentosDoItem(foco?.origem_levantamento_item_id);

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!foco) {
    return (
      <div className="p-4 lg:p-6 text-center text-muted-foreground">
        Foco não encontrado.
      </div>
    );
  }

  // Supervisores não executam transições operacionais — apenas atribuem e reatribuem
  const codigo = foco.codigo_foco ?? `FRS-${foco.id.slice(0, 8).toUpperCase()}`;

  async function confirmarTransicao() {
    if (!transDialog || !foco) return;
    if (transDialog === 'descartado' && !motivo) {
      toast.error('Motivo obrigatório para descartar.');
      return;
    }
    try {
      await atualizar.mutateAsync({
        focoId: foco.id,
        statusNovo: transDialog,
        motivo: motivo || undefined,
      });
      toast.success('Foco descartado.');
      setTransDialog(null);
      setMotivo('');
    } catch (err) {
      const msg = (err as { message?: string })?.message;
      toast.error(msg || 'Falha ao atualizar status.');
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 animate-fade-in">
      {/* Header sticky */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm pb-3 border-b border-border/60 space-y-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Voltar
          </Button>
          <span className="text-xs font-mono text-muted-foreground">{codigo}</span>
        </div>

        <div className="flex flex-wrap gap-1.5 items-center">
          <div className="flex flex-col gap-0.5">
            <StatusBadge status={foco.status as FocoRiscoStatus} />
            <span className="text-[10px] text-muted-foreground/70">
              {LABEL_STATUS_OPERACIONAL[mapFocoToStatusOperacional(foco.status as FocoStatus)]}
            </span>
          </div>
          <PrioridadeBadge prioridade={foco.prioridade} />
          <ClassificacaoBadge classificacao={foco.classificacao_inicial as FocoRiscoClassificacao} />
          <span className="inline-flex items-center gap-1">
            <SlaBadge slaStatus={foco.sla_status} prazoEm={foco.sla_prazo_em} />
            {getSlaReductionReason(foco.prioridade, foco.sla_prazo_em, foco.confirmado_em) && (
              <Info
                className="w-3.5 h-3.5 text-amber-500 cursor-help shrink-0"
                title={getSlaReductionReason(foco.prioridade, foco.sla_prazo_em, foco.confirmado_em)!}
              />
            )}
          </span>
          <RecorrenciaBadge focoAnteriorId={foco.foco_anterior_id} />
          {cruzamentosFoco.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:text-red-400">
              <Stethoscope className="w-3 h-3" />
              {cruzamentosFoco.length} caso{cruzamentosFoco.length > 1 ? 's' : ''} notificado{cruzamentosFoco.length > 1 ? 's' : ''} próximo{cruzamentosFoco.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          {[foco.logradouro, foco.bairro].filter(Boolean).join(', ') || 'Endereço não informado'}
        </p>

        {/* State machine timeline */}
        <StateMachineTimeline currentStatus={foco.status} />

        {/* Ações do gestor: apenas atribuição e reatribuição */}
        {(foco.status === 'em_triagem' || foco.status === 'aguarda_inspecao') && (
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant="default"
              className="h-7 px-3 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => { setAtribuirDialog(true); setNovoResponsavelAtribuir(''); }}
            >
              <UserCheck className="w-3.5 h-3.5 mr-1" />
              {foco.status === 'em_triagem' ? 'Encaminhar para inspeção' : 'Re-atribuir agente'}
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="resumo">
        <TabsList className="w-full grid grid-cols-6 h-auto">
          <TabsTrigger value="resumo" className="text-xs py-2">Resumo</TabsTrigger>
          <TabsTrigger value="evidencias" className="text-xs py-2">Evidências</TabsTrigger>
          <TabsTrigger value="inspecoes" className="text-xs py-2">Inspeções</TabsTrigger>
          <TabsTrigger value="reinspecoes" className="text-xs py-2 relative">
            Reinsp.
            {reinspecoes.filter(r => r.status === 'pendente' || r.status === 'vencida').length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500" />
            )}
          </TabsTrigger>
          <TabsTrigger value="sla" className="text-xs py-2">SLA</TabsTrigger>
          <TabsTrigger value="timeline" className="text-xs py-2">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Informações do Foco</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Classificação</span>
                <div className="flex items-center gap-1.5">
                  {editandoClassificacao ? (
                    <div className="flex flex-wrap gap-1.5">
                      {(['suspeito', 'risco', 'foco', 'caso_notificado'] as FocoRiscoClassificacao[]).map((c) => (
                        <button
                          key={c}
                          disabled={atualizarClassificacao.isPending}
                          onClick={async () => {
                            const res = await atualizarClassificacao.mutateAsync({ focoId: foco.id, classificacao: c });
                            if (!res.ok) toast.error(res.error ?? 'Erro ao atualizar classificação.');
                            else { toast.success('Classificação atualizada.'); setEditandoClassificacao(false); }
                          }}
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-all ${
                            foco.classificacao_inicial === c
                              ? 'ring-2 ring-primary ring-offset-1 border-primary'
                              : 'border-border opacity-60 hover:opacity-100'
                          }`}
                        >
                          {LABEL_CLASSIFICACAO_INICIAL[c]}
                        </button>
                      ))}
                      <button
                        className="text-[11px] text-muted-foreground hover:text-foreground px-1"
                        onClick={() => setEditandoClassificacao(false)}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <>
                      <ClassificacaoBadge classificacao={foco.classificacao_inicial as FocoRiscoClassificacao} size="sm" />
                      <button
                        className="text-muted-foreground hover:text-foreground"
                        title="Alterar classificação"
                        onClick={() => setEditandoClassificacao(true)}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Origem</span>
                <span className="font-medium capitalize">{foco.origem_tipo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bairro</span>
                <span className="font-medium">{foco.bairro ?? '—'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Responsável</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">{foco.responsavel_nome ?? '—'}</span>
                  <button
                    onClick={() => { setAtribuirDialog(true); setNovoResponsavelAtribuir(foco.responsavel_id ?? ''); }}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Atribuir responsável"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              </div>
              {foco.desfecho && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Desfecho</span>
                  <span className="font-medium">{foco.desfecho}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <DadosMinimosPainel focoId={foco.id} />
        </TabsContent>

        <TabsContent value="evidencias" className="mt-4 space-y-4">
          {/* Detecção original */}
          {foco.origem_levantamento_item_id && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Image className="w-4 h-4" /> Detecção original
                </CardTitle>
              </CardHeader>
              <CardContent>
                {detQuery.isLoading ? (
                  <div className="grid grid-cols-2 gap-2">{[0,1].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>
                ) : detQuery.data?.length ? (
                  <div className="grid grid-cols-2 gap-2">
                    {detQuery.data.map((ev: { id: string; image_url: string; legenda?: string }) => (
                      <div key={ev.id} className="relative rounded-lg overflow-hidden border border-border">
                        <img src={ev.image_url} alt={ev.legenda ?? 'Evidência'} className="w-full h-24 object-cover" />
                        {ev.legenda && <p className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1.5 py-0.5 truncate">{ev.legenda}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-2">Sem imagens da detecção original.</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Operações de campo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Wrench className="w-4 h-4" /> Operações de campo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {opQuery.isLoading ? (
                <Skeleton className="h-20 w-full rounded-lg" />
              ) : opQuery.data?.length ? (
                opQuery.data.map((op: { id: string; status: string; observacao?: string; concluido_em?: string; evidencias?: Array<{ id: string; image_url: string; legenda?: string }> }) => (
                  <div key={op.id} className="space-y-2 border-b border-border/40 pb-3 last:border-0">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold capitalize">{op.status}</span>
                      {op.concluido_em && <span className="text-muted-foreground">{new Date(op.concluido_em).toLocaleString('pt-BR')}</span>}
                    </div>
                    {op.observacao && <p className="text-xs text-muted-foreground">{op.observacao}</p>}
                    {op.evidencias?.length ? (
                      <div className="grid grid-cols-2 gap-1.5">
                        {op.evidencias.map((ev) => (
                          <div key={ev.id} className="relative rounded overflow-hidden border border-border">
                            <img src={ev.image_url} alt={ev.legenda ?? 'Evidência'} className="w-full h-20 object-cover" />
                            {ev.legenda && <p className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1 py-0.5 truncate">{ev.legenda}</p>}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">Nenhuma evidência registrada ainda.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inspecoes" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4" /> Inspeções de campo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {vistoriasLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-20 w-full rounded-lg" />
                  <Skeleton className="h-20 w-full rounded-lg" />
                </div>
              ) : vistoriasImovel.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Nenhuma inspeção de campo registrada para este foco.
                  </p>
                  {foco.imovel_id && (
                    <div className="flex justify-center">
                      <Button size="sm" variant="outline" onClick={() => navigate(`/agente/vistoria/${foco.imovel_id}`)}>
                        <MapPin className="w-3.5 h-3.5 mr-1.5" />
                        Registrar Inspeção
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                vistoriasImovel.map((v) => {
                  const agente = v.agente as { nome?: string } | null;
                  return (
                    <div
                      key={v.id}
                      className={cn(
                        'rounded-lg border overflow-hidden',
                        v.prioridade_final === 'P1' && 'border-red-300 bg-red-50/40 dark:bg-red-950/20 dark:border-red-800/50',
                        v.prioridade_final === 'P2' && 'border-orange-300 bg-orange-50/40 dark:bg-orange-950/20 dark:border-orange-800/50',
                        (!v.prioridade_final || !['P1', 'P2'].includes(v.prioridade_final)) && 'border-border/50',
                      )}
                    >
                      {/* cabeçalho: data, agente, badge de prioridade */}
                      <div className="flex items-center gap-2 px-3 py-2 bg-muted/20">
                        <ClipboardCheck className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-medium text-foreground">
                              {v.data_visita
                                ? new Date(v.data_visita).toLocaleDateString('pt-BR')
                                : 'Data não informada'}
                            </p>
                            {!v.acesso_realizado && (
                              <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                Sem acesso
                              </span>
                            )}
                          </div>
                          {agente?.nome && (
                            <p className="text-[11px] text-muted-foreground truncate">{agente.nome}</p>
                          )}
                        </div>
                        <PrioridadeConsolidacaoBadge prioridade={v.prioridade_final} size="sm" />
                      </div>

                      {/* dimensões analíticas + resultado operacional + motivo */}
                      {(v.resultado_operacional || v.vulnerabilidade_domiciliar || v.alerta_saude || v.risco_socioambiental || v.risco_vetorial || v.consolidacao_incompleta) && (
                        <div className="px-3 py-2 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <DimensoesBadges
                              resultado_operacional={v.resultado_operacional ?? undefined}
                              vulnerabilidade_domiciliar={v.vulnerabilidade_domiciliar ?? undefined}
                              alerta_saude={v.alerta_saude ?? undefined}
                              risco_socioambiental={v.risco_socioambiental ?? undefined}
                              risco_vetorial={v.risco_vetorial ?? undefined}
                            />
                            {v.consolidacao_incompleta && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400">
                                <AlertTriangle className="w-3 h-3" /> Incompleto
                              </span>
                            )}
                          </div>
                          {v.prioridade_motivo && (
                            <p className="text-[10px] text-muted-foreground leading-tight">
                              {v.prioridade_motivo}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Modo analítico avançado */}
                      {modoAnalitico && v.prioridade_final && (
                        <div className="px-3 pb-2">
                          <ConsolidacaoAnaliticaDetalhe
                            resultado_operacional={v.resultado_operacional ?? undefined}
                            vulnerabilidade_domiciliar={v.vulnerabilidade_domiciliar ?? undefined}
                            alerta_saude={v.alerta_saude ?? undefined}
                            risco_socioambiental={v.risco_socioambiental ?? undefined}
                            risco_vetorial={v.risco_vetorial ?? undefined}
                          />
                        </div>
                      )}

                      {!v.prioridade_final && (
                        <p className="px-3 py-2 text-[11px] text-muted-foreground italic">Consolidação pendente</p>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Aba Reinspeções ─────────────────────────────────────────────── */}
        <TabsContent value="reinspecoes" className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Reinspeções programadas</p>
            {foco && ['confirmado', 'em_tratamento'].includes(foco.status) && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={() => setNovaReinspecaoDialog(true)}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Nova
              </Button>
            )}
          </div>

          {reinspecoesLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          ) : reinspecoes.length === 0 ? (
            <Card>
              <CardContent className="py-6 text-center text-sm text-muted-foreground">
                <RotateCcw className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                Nenhuma reinspeção programada.
                {foco && foco.status === 'em_tratamento' && (
                  <p className="mt-1 text-xs">
                    Uma reinspeção automática deveria ter sido criada ao entrar em tratamento.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {reinspecoes.map((r) => (
                <ReinspecaoCard
                  key={r.id}
                  reinspecao={r}
                  onReagendar={() => { setReagendarDialog(r.id); setReagendarData(''); }}
                  onCancelar={() => handleCancelarReinspecao(r.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Aba SLA ─────────────────────────────────────────────────────── */}
        <TabsContent value="sla" className="mt-4 space-y-4">
          {/* SLA Operacional (existente) */}
          <Card>
            <CardHeader><CardTitle className="text-sm">SLA Operacional</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <SlaBadge slaStatus={foco.sla_status} prazoEm={foco.sla_prazo_em} />
              </div>
              {foco.sla_prazo_em && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Prazo</span>
                  <span className="font-medium">{new Date(foco.sla_prazo_em).toLocaleString('pt-BR')}</span>
                </div>
              )}
              {(() => {
                const reason = getSlaReductionReason(foco.prioridade, foco.sla_prazo_em, foco.confirmado_em);
                return reason ? (
                  <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-2 text-xs text-amber-800 dark:text-amber-300">
                    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{reason}</span>
                  </div>
                ) : null;
              })()}
            </CardContent>
          </Card>

          {/* SLA Inteligente (Fase A) */}
          {slaInt && slaInt.status_sla_inteligente && slaInt.status_sla_inteligente !== 'encerrado' && (
            <Card className={
              slaInt.status_sla_inteligente === 'vencido' ? 'border-red-200 dark:border-red-800/50' :
              slaInt.status_sla_inteligente === 'critico' ? 'border-orange-200 dark:border-orange-800/50' : ''
            }>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  {slaInt.status_sla_inteligente === 'vencido' ? (
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  ) : slaInt.status_sla_inteligente === 'critico' ? (
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                  ) : (
                    <Clock className="w-4 h-4 text-primary" />
                  )}
                  SLA Inteligente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Status</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${COR_STATUS_SLA_INT[slaInt.status_sla_inteligente as SlaInteligenteStatus]}`}>
                    {LABEL_STATUS_SLA_INT[slaInt.status_sla_inteligente as SlaInteligenteStatus]}
                  </span>
                </div>
                {slaInt.fase_sla && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fase atual</span>
                    <span className="font-medium">{LABEL_FASE_SLA[slaInt.fase_sla as FaseSla]}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tempo neste estado</span>
                  <span className="font-medium tabular-nums">{formatarTempoMin(slaInt.tempo_em_estado_atual_min)}</span>
                </div>
                {slaInt.prazo_fase_min != null && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Prazo da fase</span>
                      <span className="font-medium tabular-nums">{formatarTempoMin(slaInt.prazo_fase_min)}</span>
                    </div>
                    {slaInt.tempo_em_estado_atual_min != null && slaInt.prazo_fase_min > 0 && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Uso do prazo</span>
                          <span>{Math.min(100, Math.round((slaInt.tempo_em_estado_atual_min / slaInt.prazo_fase_min) * 100))}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              slaInt.status_sla_inteligente === 'vencido' ? 'bg-red-500' :
                              slaInt.status_sla_inteligente === 'critico' ? 'bg-orange-500' :
                              slaInt.status_sla_inteligente === 'atencao' ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.round((slaInt.tempo_em_estado_atual_min / slaInt.prazo_fase_min) * 100))}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          {id && <FocoRiscoTimeline focoId={id} />}
        </TabsContent>
      </Tabs>

      {/* Dialog: nova reinspeção manual */}
      <Dialog open={novaReinspecaoDialog} onOpenChange={setNovaReinspecaoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Nova reinspeção
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="data-reinspecao">Data prevista <span className="text-destructive">*</span></Label>
              <Input
                id="data-reinspecao"
                type="datetime-local"
                value={novaDataPrevista}
                onChange={(e) => setNovaDataPrevista(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agente-reinspecao">Agente responsável (opcional)</Label>
              <Select value={novoResponsavelId} onValueChange={setNovoResponsavelId}>
                <SelectTrigger id="agente-reinspecao">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {agentes.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.nome || a.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovaReinspecaoDialog(false)}>Cancelar</Button>
            <Button
              onClick={handleCriarReinspecao}
              disabled={!novaDataPrevista || criarReinspecao.isPending}
            >
              Criar reinspeção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: reagendar */}
      <Dialog open={!!reagendarDialog} onOpenChange={(v) => { if (!v) setReagendarDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reagendar reinspeção</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="reagendar-data">Nova data prevista <span className="text-destructive">*</span></Label>
            <Input
              id="reagendar-data"
              type="datetime-local"
              value={reagendarData}
              onChange={(e) => setReagendarData(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReagendarDialog(null)}>Cancelar</Button>
            <Button
              onClick={handleReagendar}
              disabled={!reagendarData || reagendarReinspecao.isPending}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de transição */}
      <Dialog open={!!transDialog} onOpenChange={(v) => { if (!v) { setTransDialog(null); setResponsavelSelecionado(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {transDialog === 'aguarda_inspecao' && <UserCheck className="w-4 h-4 text-blue-600" />}
              {transDialog === 'aguarda_inspecao'
                ? 'Encaminhar para inspeção'
                : `Alterar para: ${transDialog ? (LABEL_STATUS[transDialog] ?? transDialog) : ''}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {transDialog === 'aguarda_inspecao' && (
              <div className="space-y-2">
                <Label htmlFor="agente-select">
                  Agente responsável <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={responsavelSelecionado}
                  onValueChange={setResponsavelSelecionado}
                >
                  <SelectTrigger id="agente-select">
                    <SelectValue placeholder="Selecione o agente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {agentes.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.nome || a.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="motivo-detalhe">
                Motivo {transDialog === 'descartado' ? '(obrigatório)' : '(opcional)'}
              </Label>
              <Input
                id="motivo-detalhe"
                placeholder="Descreva o motivo..."
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTransDialog(null); setResponsavelSelecionado(''); }}>
              Cancelar
            </Button>
            <Button
              onClick={confirmarTransicao}
              disabled={
                atualizar.isPending ||
                (transDialog === 'descartado' && !motivo) ||
                (transDialog === 'aguarda_inspecao' && !responsavelSelecionado)
              }
              className={transDialog === 'aguarda_inspecao' ? 'bg-blue-600 hover:bg-blue-700' : ''}
            >
              {transDialog === 'aguarda_inspecao' ? 'Encaminhar' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog — Atribuir Responsável */}
      <Dialog open={atribuirDialog} onOpenChange={setAtribuirDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Atribuir Responsável</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Select value={novoResponsavelAtribuir} onValueChange={setNovoResponsavelAtribuir}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o agente..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__remove__">— Remover responsável —</SelectItem>
                {agentes.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nome || a.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAtribuirDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => atribuirMutation.mutate(novoResponsavelAtribuir === '__remove__' ? '' : novoResponsavelAtribuir)}
              disabled={atribuirMutation.isPending}
            >
              {atribuirMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
