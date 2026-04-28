/**
 * AgenteFocoDetalhe — Página canônica do agente para operar um foco de risco.
 *
 * Rota: /agente/focos/:focoId
 *
 * Fluxo canônico e CTAs por status:
 *   aguarda_inspecao → "Iniciar inspeção"  (único CTA — agente ainda não viu o foco)
 *   em_inspecao      → "Confirmar foco" | "Descartar foco"  (agente viu e decide)
 *   confirmado       → "Iniciar tratamento"  (único CTA — foco confirmado, tratamento obrigatório)
 *   em_tratamento    → "Resolver foco"  (único CTA — só resolve após tratar)
 *
 * Descarte só é oferecido em `em_inspecao`: é a única etapa onde o agente
 * pode constatar que o foco não existe ou foi resolvido naturalmente.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, MapPin, Hash, Building2, CheckCircle2, XCircle,
  PlayCircle, Wrench, ClipboardCheck, AlertTriangle, CalendarClock, RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/foco/StatusBadge';
import { PrioridadeBadge } from '@/components/foco/PrioridadeBadge';
import { SlaBadge } from '@/components/foco/SlaBadge';
import { FocoRiscoTimeline } from '@/components/foco/FocoRiscoTimeline';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import {
  useIniciarInspecaoFoco,
  useAtualizarStatusFoco,
} from '@/hooks/queries/useFocosRisco';
import { useReinspecoesByFoco } from '@/hooks/queries/useReinspecoes';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { logEvento } from '@/lib/pilotoEventos';
import type { FocoRiscoAtivo, FocoRiscoStatus, TipoImovel } from '@/types/database';

// ── Tipos ──────────────────────────────────────────────────────────────────────

type CtaMode = 'idle' | 'descartar' | 'resolver';

// ── Helpers ────────────────────────────────────────────────────────────────────

const TERMINAL: FocoRiscoStatus[] = ['resolvido', 'descartado'];

function isTerminal(status: FocoRiscoStatus) {
  return TERMINAL.includes(status);
}

// ── Componente ─────────────────────────────────────────────────────────────────

export default function AgenteFocoDetalhe() {
  const { focoId } = useParams<{ focoId: string }>();
  const navigate = useNavigate();

  const [ctaMode, setCtaMode] = useState<CtaMode>('idle');
  const [motivo, setMotivo] = useState('');
  const [concluido, setConcluido] = useState<'resolvido' | 'descartado' | null>(null);

  // Formulário de cadastro de imóvel em campo (quando foco não tem imovel_id)
  const [imovelForm, setImovelForm] = useState({
    logradouro: '',
    numero: '',
    quarteirao: '',
    tipo_imovel: 'residencial' as TipoImovel,
  });
  const [cadastrandoImovel, setCadastrandoImovel] = useState(false);

  const { clienteId } = useClienteAtivo();
  const iniciarInspecao = useIniciarInspecaoFoco();
  const atualizarStatus = useAtualizarStatusFoco();

  // Reinspeções — carregadas somente quando o foco está disponível
  const { data: reinspecoes = [] } = useReinspecoesByFoco(focoId ?? null);

  // Busca foco enriquecido (view com joins: bairro, quarteirao, sla, etc.)
  const { data: foco, isLoading, refetch } = useQuery<FocoRiscoAtivo | null>({
    queryKey: ['foco_risco_agente', focoId],
    queryFn: () => api.focosRisco.getPorId(focoId!),
    enabled: !!focoId,
    staleTime: STALE.SHORT,
  });

  // Pré-preenche logradouro do formulário de imóvel quando o foco carrega
  useEffect(() => {
    if (foco && !foco.imovel_id) {
      const logradouro = foco.logradouro ?? foco.endereco_normalizado ?? '';
      setImovelForm((prev) => prev.logradouro ? prev : { ...prev, logradouro });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foco?.id]);

  // Instrumentação: log ao abrir o foco
  useEffect(() => {
    if (foco?.id && clienteId) {
      logEvento('foco_visualizado', clienteId, {
        foco_id: foco.id,
        status: foco.status,
        prioridade: foco.prioridade,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foco?.id]);

  // ── Handlers ──────────────────────────────────────────────────────────────────

  async function handleIniciarInspecao() {
    if (!focoId) return;
    try {
      await iniciarInspecao.mutateAsync({ focoId });
      logEvento('foco_inspecao_iniciada', clienteId, { foco_id: focoId });
      await refetch();
      toast.success('Inspeção iniciada.');
    } catch {
      toast.error('Erro ao iniciar inspeção. Tente novamente.');
    }
  }

  async function handleTransicionar(statusNovo: FocoRiscoStatus) {
    if (!focoId) return;
    try {
      await atualizarStatus.mutateAsync({
        focoId,
        statusNovo,
        motivo: motivo.trim() || undefined,
      });
      // Instrumentação por transição
      const eventoMap: Partial<Record<FocoRiscoStatus, Parameters<typeof logEvento>[0]>> = {
        confirmado:      'foco_confirmado',
        descartado:      'foco_descartado',
        em_tratamento:   'foco_tratamento_iniciado',
        resolvido:       'foco_resolvido',
      };
      const evento = eventoMap[statusNovo];
      if (evento) logEvento(evento, clienteId, { foco_id: focoId, status_novo: statusNovo });

      if (isTerminal(statusNovo)) {
        setConcluido(statusNovo as 'resolvido' | 'descartado');
      } else {
        setCtaMode('idle');
        setMotivo('');
        await refetch();
        toast.success('Status atualizado.');
      }
    } catch {
      toast.error('Erro ao atualizar status. Tente novamente.');
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 max-w-lg mx-auto">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-36 w-full rounded-xl" />
      </div>
    );
  }

  // ── Foco não encontrado (encerrado ou sem acesso) ─────────────────────────────

  if (!foco) {
    return (
      <div className="p-6 max-w-lg mx-auto space-y-4 text-center">
        <AlertTriangle className="w-10 h-10 text-muted-foreground mx-auto" />
        <p className="text-sm font-semibold text-foreground">Foco não disponível</p>
        <p className="text-xs text-muted-foreground">
          Este foco pode já ter sido encerrado ou não está mais atribuído a você.
        </p>
        <Button variant="outline" className="w-full" onClick={() => navigate('/agente/hoje')}>
          Voltar para hoje
        </Button>
      </div>
    );
  }

  // ── Tela de conclusão (terminal) ───────────────────────────────────────────────

  if (concluido) {
    const isResolvido = concluido === 'resolvido';
    return (
      <div className="p-4 lg:p-6 max-w-md mx-auto space-y-6 text-center animate-fade-in">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
          isResolvido
            ? 'bg-green-100 dark:bg-green-900/30'
            : 'bg-gray-100 dark:bg-gray-800/40'
        }`}>
          {isResolvido
            ? <ClipboardCheck className="w-8 h-8 text-green-600" />
            : <XCircle className="w-8 h-8 text-gray-500" />
          }
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold">
            {isResolvido ? 'Foco resolvido' : 'Foco descartado'}
          </h2>
          {foco.codigo_foco && (
            <p className="text-sm text-muted-foreground font-mono">{foco.codigo_foco}</p>
          )}
        </div>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => navigate('/agente/hoje')}
        >
          Voltar para hoje
        </Button>
      </div>
    );
  }

  // ── Endereço ───────────────────────────────────────────────────────────────────

  const enderecoLinha1 = [foco.logradouro, foco.numero].filter(Boolean).join(', ')
    || foco.endereco_normalizado
    || 'Endereço não informado';

  const enderecoLinha2 = [foco.bairro, foco.regiao_nome].filter(Boolean).join(' · ');

  // ── Cadastro de imóvel em campo ────────────────────────────────────────────────

  async function handleCadastrarImovel() {
    if (!clienteId || !foco) return;
    if (!imovelForm.numero.trim()) {
      toast.warning('Número do imóvel é obrigatório.');
      return;
    }
    setCadastrandoImovel(true);
    try {
      const logradouro = imovelForm.logradouro.trim();
      const numero = imovelForm.numero.trim();

      // Busca imóvel existente — falha silenciosa (prossegue para criação)
      let imovel: { id: string } | null = null;
      if (logradouro) {
        try {
          imovel = await api.imoveis.findByEndereco(clienteId, logradouro, numero) as { id: string } | null;
        } catch (e) {
          console.warn('[cadastrarImovel] findByEndereco falhou, prosseguindo para criar:', e);
        }
      }

      if (imovel) {
        toast.info('Imóvel já cadastrado neste endereço — vinculado ao foco.');
      } else {
        imovel = await api.imoveis.create({
          regiao_id: foco.regiao_id ?? undefined,
          tipo_imovel: imovelForm.tipo_imovel,
          logradouro: logradouro || undefined,
          numero,
          bairro: foco.bairro ?? undefined,
          quarteirao: imovelForm.quarteirao.trim() || undefined,
          latitude: foco.latitude ?? undefined,
          longitude: foco.longitude ?? undefined,
          proprietario_ausente: false,
          tem_animal_agressivo: false,
          historico_recusa: false,
          tem_calha: false,
          calha_acessivel: true,
          prioridade_drone: false,
        }) as { id: string };
        toast.success('Imóvel cadastrado e vinculado ao foco.');
      }

      await api.focosRisco.vincularImovel(foco.id, imovel.id);
      await refetch();
    } catch (err) {
      console.error('[cadastrarImovel]', err);
      const msg = (err as { status?: number; message?: string })?.status
        ? `Erro ${(err as { status: number }).status}: ${(err as { message: string }).message}`
        : 'Erro ao cadastrar imóvel. Tente novamente.';
      toast.error(msg);
    } finally {
      setCadastrandoImovel(false);
    }
  }

  // ── CTAs por status ────────────────────────────────────────────────────────────

  const isPending = iniciarInspecao.isPending || atualizarStatus.isPending;

  function renderCtaSection() {
    const status = foco!.status as FocoRiscoStatus;

    // Painel de confirmação de descarte — só acessível a partir de em_inspecao
    if (ctaMode === 'descartar' && status === 'em_inspecao') {
      return (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 space-y-3">
          <p className="text-sm font-semibold text-destructive">Confirmar descarte</p>
          <p className="text-xs text-muted-foreground">
            O foco será encerrado como descartado. Esta ação não pode ser desfeita.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="motivo-desc" className="text-xs font-semibold">
              Motivo <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              id="motivo-desc"
              placeholder="Ex.: não encontrado, falso positivo..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              className="resize-none text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={isPending}
              onClick={() => { setCtaMode('idle'); setMotivo(''); }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={isPending}
              onClick={() => handleTransicionar('descartado')}
            >
              {isPending ? 'Descartando...' : 'Confirmar'}
            </Button>
          </div>
        </div>
      );
    }

    // Painel de resolução
    if (ctaMode === 'resolver') {
      return (
        <div className="rounded-xl border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/20 p-4 space-y-3">
          <p className="text-sm font-semibold text-green-700 dark:text-green-400">Registrar resolução</p>
          <div className="space-y-1.5">
            <Label htmlFor="motivo-res" className="text-xs font-semibold">
              Observação <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              id="motivo-res"
              placeholder="Descreva o que foi feito para resolver o foco..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              className="resize-none text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={isPending}
              onClick={() => { setCtaMode('idle'); setMotivo(''); }}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              disabled={isPending}
              onClick={() => handleTransicionar('resolvido')}
            >
              {isPending ? 'Salvando...' : 'Confirmar resolução'}
            </Button>
          </div>
        </div>
      );
    }

    // CTAs principais por status
    switch (status) {
      case 'aguarda_inspecao':
        return (
          <Button
            size="lg"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold"
            disabled={isPending}
            onClick={handleIniciarInspecao}
          >
            <PlayCircle className="w-4 h-4 mr-2" />
            {isPending ? 'Iniciando...' : 'Iniciar inspeção'}
          </Button>
        );

      case 'em_inspecao':
        // Sem imóvel vinculado: mostrar formulário de cadastro antes de permitir vistoria
        if (!foco!.imovel_id) {
          return (
            <div className="space-y-3">
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <p className="text-sm font-bold text-amber-700 dark:text-amber-300">Cadastrar imóvel</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Este foco não tem imóvel cadastrado. Registre o imóvel para iniciar a vistoria.
                </p>
                <div className="space-y-2.5">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Logradouro</Label>
                    <Input
                      placeholder="Rua, Av., Travessa..."
                      value={imovelForm.logradouro}
                      onChange={(e) => setImovelForm((p) => ({ ...p, logradouro: e.target.value }))}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">
                        Número <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        placeholder="Ex: 123"
                        value={imovelForm.numero}
                        onChange={(e) => setImovelForm((p) => ({ ...p, numero: e.target.value }))}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold">Quarteirão</Label>
                      <Input
                        placeholder="Ex: 045"
                        value={imovelForm.quarteirao}
                        onChange={(e) => setImovelForm((p) => ({ ...p, quarteirao: e.target.value }))}
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Tipo de imóvel</Label>
                    <Select
                      value={imovelForm.tipo_imovel}
                      onValueChange={(v) => setImovelForm((p) => ({ ...p, tipo_imovel: v as TipoImovel }))}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="residencial">Residencial</SelectItem>
                        <SelectItem value="comercial">Comercial</SelectItem>
                        <SelectItem value="terreno">Terreno</SelectItem>
                        <SelectItem value="ponto_estrategico">Ponto estratégico</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="w-full font-bold"
                  disabled={cadastrandoImovel || !imovelForm.numero.trim()}
                  onClick={handleCadastrarImovel}
                >
                  <Building2 className="w-4 h-4 mr-1.5" />
                  {cadastrandoImovel ? 'Cadastrando...' : 'Cadastrar imóvel'}
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
                disabled={isPending}
                onClick={() => setCtaMode('descartar')}
              >
                <XCircle className="w-4 h-4 mr-1.5" />
                Descartar foco
              </Button>
            </div>
          );
        }

        // Com imóvel vinculado: acesso direto à vistoria
        return (
          <div className="space-y-2">
            <Button
              size="lg"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              onClick={() => navigate(`/agente/vistoria/${foco!.imovel_id}?focoId=${foco!.id}&atividade=pesquisa`)}
            >
              <ClipboardCheck className="w-4 h-4 mr-2" />
              Realizar vistoria completa
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
              disabled={isPending}
              onClick={() => setCtaMode('descartar')}
            >
              <XCircle className="w-4 h-4 mr-1.5" />
              Descartar foco
            </Button>
          </div>
        );

      case 'confirmado':
        return (
          <Button
            size="lg"
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold"
            disabled={isPending}
            onClick={() => handleTransicionar('em_tratamento')}
          >
            <Wrench className="w-4 h-4 mr-2" />
            {isPending ? 'Iniciando...' : 'Iniciar tratamento'}
          </Button>
        );

      case 'em_tratamento':
        return (
          <Button
            size="lg"
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold"
            disabled={isPending}
            onClick={() => setCtaMode('resolver')}
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Resolver foco
          </Button>
        );

      default:
        return null;
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 lg:p-6 max-w-lg mx-auto space-y-5 animate-fade-in pb-10">
      {/* Header */}
      <div className="space-y-2">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar
        </Button>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold leading-tight">Foco de Risco</h1>
            {foco.codigo_foco && (
              <div className="flex items-center gap-1 mt-0.5">
                <Hash className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="font-mono text-sm text-muted-foreground tracking-wider">
                  {foco.codigo_foco}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <StatusBadge status={foco.status as FocoRiscoStatus} />
            <PrioridadeBadge prioridade={foco.prioridade} />
          </div>
        </div>
      </div>

      {/* SLA */}
      {(foco.sla_status || foco.sla_prazo_em) && (
        <SlaBadge slaStatus={foco.sla_status} prazoEm={foco.sla_prazo_em} />
      )}

      {/* Localização */}
      <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{enderecoLinha1}</p>
            {enderecoLinha2 && (
              <p className="text-xs text-muted-foreground mt-0.5">{enderecoLinha2}</p>
            )}
          </div>
        </div>
        {(foco.quarteirao || foco.tipo_imovel) && (
          <div className="flex items-center gap-2 flex-wrap">
            {foco.quarteirao && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Building2 className="w-3.5 h-3.5" />
                Quadra {foco.quarteirao}
              </span>
            )}
            {foco.tipo_imovel && (
              <span className="text-xs text-muted-foreground">· {foco.tipo_imovel}</span>
            )}
          </div>
        )}
      </div>

      {/* CTAs */}
      <div className="pt-1">
        {renderCtaSection()}
      </div>

      {/* Reinspeção pendente (relevante em em_tratamento) */}
      {foco.status === 'em_tratamento' && (() => {
        const pendente = reinspecoes.find(
          (r) => r.status === 'pendente' || r.status === 'vencida',
        );
        if (!pendente) return null;
        const dataFormatada = new Date(pendente.data_prevista as string).toLocaleString('pt-BR', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        });
        const isVencida = pendente.status === 'vencida';
        return (
          <div className={`rounded-xl border p-3 space-y-2 ${
            isVencida
              ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/20'
              : 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20'
          }`}>
            <div className="flex items-start gap-2">
              <RotateCcw className={`w-4 h-4 mt-0.5 shrink-0 ${isVencida ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${isVencida ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}`}>
                  {isVencida ? 'Reinspeção vencida' : 'Reinspeção pendente'}
                </p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                  <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                  <span>Prevista: {dataFormatada}</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              className={`w-full rounded-lg py-2 text-xs font-bold text-white transition-colors ${
                isVencida ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
              }`}
              onClick={() => navigate(`/agente/reinspecao/${pendente.id}`)}
            >
              Executar reinspeção
            </button>
          </div>
        );
      })()}

      {/* Timeline */}
      <div className="pt-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
          Histórico
        </p>
        <FocoRiscoTimeline focoId={foco.id} />
      </div>
    </div>
  );
}
