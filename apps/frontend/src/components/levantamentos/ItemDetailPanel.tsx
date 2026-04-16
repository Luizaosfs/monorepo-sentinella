import { LevantamentoItem, StatusAtendimento, FocoRiscoStatus } from '@/types/database';
import { resolveMediaUrl } from '@/lib/media';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  MapPin, Navigation, AlertTriangle, Clock, Hash, ArrowLeft,
  ExternalLink, Image as ImageIcon, X, ChevronLeft, ChevronRight,
  Plane, Camera, Compass, Upload, RotateCcw,
} from 'lucide-react';
import { api } from '@/services/api';
import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { invalidateAtendimentoItemCaches } from '@/lib/invalidateAtendimentoQueries';
import { StatusBadge } from './StatusBadge';
import { useRecorrenciasAtivas } from '@/hooks/queries/useRecorrencias';
import { useFocoByLevantamentoItem } from '@/hooks/queries/useFocosRisco';
import { focoStatusToAtendimento, avancarFocoAte } from '@/lib/focosRiscoUtils';
import { useYoloFeedback, useYoloFeedbackMutation } from '@/hooks/queries/useYoloFeedback';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { enqueue } from '@/lib/offlineQueue';
import { cn } from '@/lib/utils';

// Subcomponents
import { ItemScoreBadge, normalizeScore, getScoreConfig } from './detail/ItemScoreBadge';
import { useItemDetecoes } from '@/hooks/queries/useItemDetecoes';
import { YoloOverlayGroup, YoloDetectionsSummary } from '@/components/levantamentos/YoloImageOverlays';
import { ItemCasosNotificados } from './detail/ItemCasosNotificados';
import { ItemSlaTimeline } from './detail/ItemSlaTimeline';
import { ItemPlanoAcao } from './detail/ItemPlanoAcao';
import { ItemEsusNotifica } from './detail/ItemEsusNotifica';
import { ItemEvidencias } from './detail/ItemEvidencias';
import { useEvidenciasAtendimento } from '@/hooks/queries/useEvidenciasAtendimento';


interface ItemDetailPanelProps {
  item: LevantamentoItem;
  onBack: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  currentIndex?: number;
  totalCount?: number;
  /** Chamado após salvar observação do atendimento (para o pai atualizar o item). */
  onObservacaoSaved?: (observacao: string | null) => void;
  /** Chamado após salvar status/ação aplicada (para o pai atualizar o item). */
  onStatusChanged?: (status: StatusAtendimento, acaoAplicada: string | null) => void;
  /**
   * `sheet` — painéis estreitos (ex.: drawer no mapa): uma coluna, sem grid 4/8 que espreme a mídia.
   */
  variant?: 'default' | 'sheet';
}

const ItemDetailPanel = ({
  item,
  onBack,
  onPrev,
  onNext,
  currentIndex,
  totalCount,
  onStatusChanged,
  variant = 'default',
}: ItemDetailPanelProps) => {
  const isSheet = variant === 'sheet';
  const imageUrl = resolveMediaUrl(item.image_url);
  const [imgError, setImgError] = useState(false);
  const [imgFullscreen, setImgFullscreen] = useState(false);

  const [statusLocal, setStatusLocal] = useState<StatusAtendimento>(() => item.status_atendimento ?? 'pendente');
  const [acaoAplicadaLocal, setAcaoAplicadaLocal] = useState(() => item.acao_aplicada ?? '');
  const [isSavingAtendimento, setSavingAtendimento] = useState(false);
  const [checkinEm, setCheckinEm] = useState<string | null>(null);

  const { clienteId } = useClienteAtivo();
  const queryClient = useQueryClient();

  const invalidateCaches = () => {
    if (clienteId) {
      invalidateAtendimentoItemCaches(queryClient, {
        clienteId,
        levantamentoId: item.levantamento_id,
      });
    }
  };
  const { data: focoRisco } = useFocoByLevantamentoItem(item.id, clienteId);
  const { data: recorrencias = [] } = useRecorrenciasAtivas(clienteId);
  const { data: yoloFeedback } = useYoloFeedback(item.tipo_entrada !== 'MANUAL' ? item.id : null, clienteId);
  const yoloFeedbackMutation = useYoloFeedbackMutation();
  const [isSavingFeedback, setSavingFeedback] = useState(false);
  const { evidencias } = useEvidenciasAtendimento(item.id);
  const evidenciasCount = evidencias.length;

  const scoreNorm = normalizeScore(item.score_final);
  const bbox = item.detection_bbox ?? null;
  // Detecções secundárias — só para itens YOLO (tipo_entrada !== 'MANUAL')
  const { data: detecoes = [] } = useItemDetecoes(
    item.tipo_entrada !== 'MANUAL' ? item.id : null
  );
  const recorrenciaAtual = item.endereco_curto
    ? recorrencias.find((r) => r.endereco_ref === item.endereco_curto)
    : undefined;

  useEffect(() => { setImgError(false); }, [item.id]);
  useEffect(() => {
    if (focoRisco) {
      setStatusLocal(focoStatusToAtendimento(focoRisco.status as FocoRiscoStatus));
      setAcaoAplicadaLocal(focoRisco.desfecho ?? item.acao_aplicada ?? '');
      setCheckinEm(focoRisco.status !== 'suspeita' ? focoRisco.updated_at : null);
    } else {
      setStatusLocal(item.status_atendimento ?? 'pendente');
      setAcaoAplicadaLocal(item.acao_aplicada ?? '');
      setCheckinEm(null);
    }
  }, [item.id, focoRisco?.id, focoRisco?.status, focoRisco?.desfecho, focoRisco?.updated_at, item.status_atendimento, item.acao_aplicada]);

  const handleSaveAtendimento = async (statusOverride?: StatusAtendimento) => {
    const statusFinal = statusOverride ?? statusLocal;
    setSavingAtendimento(true);
    try {
      const acao = acaoAplicadaLocal.trim() || null;
      if (focoRisco) {
        if (statusFinal === 'resolvido') {
          await avancarFocoAte(focoRisco.id, focoRisco.status as FocoRiscoStatus, 'resolvido', acao);
          if (acao) await api.focosRisco.update(focoRisco.id, { desfecho: acao });
        } else if (acao) {
          await api.focosRisco.update(focoRisco.id, { desfecho: acao });
        }
        queryClient.invalidateQueries({ queryKey: ['foco_by_item', item.id] });
        queryClient.invalidateQueries({ queryKey: ['focos_risco'] });
      } else {
        await api.itens.updateAtendimento(item.id, { status_atendimento: statusFinal, acao_aplicada: acao });
      }
      invalidateCaches();
      const msg =
        statusFinal === 'resolvido' ? 'Item resolvido!' :
          statusOverride === 'em_atendimento' ? 'Progresso salvo.' :
            'Status atualizado';
      toast.success(msg);
      if (statusOverride) setStatusLocal(statusFinal);
      onStatusChanged?.(statusFinal, acao);
    } catch (err) {
      if (!navigator.onLine) {
        const acao = acaoAplicadaLocal.trim() || null;
        await enqueue({ type: 'update_atendimento', itemId: item.id, focoRiscoId: focoRisco?.id, status: statusFinal, acaoAplicada: acao, createdAt: Date.now() });
        if (statusOverride) setStatusLocal(statusFinal);
        onStatusChanged?.(statusFinal, acao);
        toast.warning('Sem conexão — será sincronizado ao reconectar.');
      } else {
        toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
      }
    } finally {
      setSavingAtendimento(false);
    }
  };

  const handleIniciarAtendimento = async () => {
    setSavingAtendimento(true);
    try {
      let coords: { latitude: number; longitude: number } | undefined;
      if (navigator.geolocation) {
        coords = await new Promise<{ latitude: number; longitude: number } | undefined>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
            () => resolve(undefined),
            { timeout: 6000, maximumAge: 30000, enableHighAccuracy: false }
          );
        });
      }
      await api.itens.registrarCheckin(item.id, coords);
      if (focoRisco) {
        await avancarFocoAte(focoRisco.id, focoRisco.status as FocoRiscoStatus, 'em_tratamento', 'Atendimento iniciado em campo');
        queryClient.invalidateQueries({ queryKey: ['foco_by_item', item.id] });
        queryClient.invalidateQueries({ queryKey: ['focos_risco'] });
      } else {
        await api.itens.updateAtendimento(item.id, { status_atendimento: 'em_atendimento', acao_aplicada: null });
      }
      invalidateCaches();
      setCheckinEm(new Date().toISOString());
      setStatusLocal('em_atendimento');
      onStatusChanged?.('em_atendimento', null);
      toast.success('Atendimento iniciado' + (coords ? ' — chegada registrada com GPS.' : '.'));
    } catch (err) {
      if (!navigator.onLine) {
        await enqueue({ type: 'checkin', itemId: item.id, coords: undefined, createdAt: Date.now() });
        await enqueue({ type: 'update_atendimento', itemId: item.id, focoRiscoId: focoRisco?.id, status: 'em_atendimento', acaoAplicada: null, createdAt: Date.now() + 1 });
        setCheckinEm(new Date().toISOString());
        setStatusLocal('em_atendimento');
        onStatusChanged?.('em_atendimento', null);
        toast.warning('Sem conexão — atendimento iniciado e será sincronizado ao reconectar.');
      } else {
        toast.error(err instanceof Error ? err.message : 'Erro ao iniciar atendimento');
      }
    } finally {
      setSavingAtendimento(false);
    }
  };

  const handleCancelarAtendimento = async () => {
    setSavingAtendimento(true);
    try {
      if (focoRisco) {
        await avancarFocoAte(focoRisco.id, focoRisco.status as FocoRiscoStatus, 'descartado', 'Cancelado pelo operador');
        queryClient.invalidateQueries({ queryKey: ['foco_by_item', item.id] });
        queryClient.invalidateQueries({ queryKey: ['focos_risco'] });
      } else {
        await api.itens.updateAtendimento(item.id, { status_atendimento: 'pendente', acao_aplicada: null });
      }
      invalidateCaches();
      setStatusLocal('pendente');
      setAcaoAplicadaLocal('');
      onStatusChanged?.('pendente', null);
      toast.info('Atendimento cancelado.');
    } catch (err) {
      if (!navigator.onLine) {
        await enqueue({ type: 'update_atendimento', itemId: item.id, focoRiscoId: focoRisco?.id, status: 'pendente', acaoAplicada: null, createdAt: Date.now() });
        setStatusLocal('pendente');
        setAcaoAplicadaLocal('');
        onStatusChanged?.('pendente', null);
        toast.warning('Sem conexão — cancelamento será sincronizado ao reconectar.');
      } else {
        toast.error(err instanceof Error ? err.message : 'Erro ao cancelar atendimento');
      }
    } finally {
      setSavingAtendimento(false);
    }
  };

  const handleConfirmarResolucao = () => {
    if (acaoAplicadaLocal.trim().length < 10) {
      toast.error('Descreva o que foi feito no local (mínimo 10 caracteres).');
      return;
    }
    const risco = (item.risco ?? '').toLowerCase();
    if ((risco === 'alto' || risco === 'critico') && evidenciasCount === 0) {
      toast.error('Item de alto risco requer pelo menos uma foto de evidência antes de ser resolvido.');
      return;
    }
    handleSaveAtendimento('resolvido');
  };

  const handleFalsoPositivo = async () => {
    if (!clienteId) return;
    setSavingFeedback(true);
    try {
      const jaEstaFalso = yoloFeedback?.confirmado === false;
      await yoloFeedbackMutation.mutateAsync({
        levantamento_item_id: item.id,
        cliente_id: clienteId,
        confirmado: jaEstaFalso ? true : false,
      });
      toast.success(jaEstaFalso ? 'Marcado como confirmado em campo.' : 'Marcado como falso positivo — obrigado pelo feedback!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar feedback');
    } finally {
      setSavingFeedback(false);
    }
  };

  return (
    <div
      className={cn(
        'animate-in fade-in slide-in-from-bottom-4 duration-500',
        isSheet ? 'space-y-2' : 'space-y-2 lg:space-y-3',
      )}
    >
      {/* Header */}
      <Card
        className={cn(
          'overflow-hidden rounded-2xl border-2 border-border bg-card text-card-foreground',
          isSheet
            ? 'rounded-xl border shadow-sm'
            : 'shadow-lg shadow-black/5 dark:shadow-black/20',
        )}
      >
        <div className={cn('flex items-center justify-between', isSheet ? 'px-2 py-2' : 'px-3 py-2.5 lg:px-5 lg:py-3')}>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-foreground hover:bg-accent rounded-xl transition-all active:scale-95"
              onClick={onBack}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <h3 className="text-base lg:text-lg font-bold text-primary truncate tracking-tight">{item.item || 'Sem título'}</h3>
              {currentIndex != null && totalCount != null && (
                <p className="text-[11px] lg:text-xs text-muted-foreground font-medium">
                  Item {currentIndex + 1} de {totalCount}
                </p>
              )}
            </div>
          </div>
          {(onPrev || onNext) && (
            <div className="flex items-center gap-2 shrink-0 ml-4">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-foreground hover:bg-accent rounded-lg transition-all active:scale-95" onClick={onPrev} disabled={!onPrev}>
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-foreground hover:bg-accent rounded-lg transition-all active:scale-95" onClick={onNext} disabled={!onNext}>
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Main content: em `sheet` empilha tudo em largura total; senão grid 4+8 no desktop */}
      <div
        className={cn(
          isSheet ? 'flex flex-col gap-2' : 'grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-3',
        )}
      >
        {/* Left Column: Media & Primary Info */}
        <div className={cn(isSheet ? 'space-y-2' : 'lg:col-span-4 space-y-2 lg:space-y-3')}>
          <div className="space-y-2">
            {/* Image */}
            {imageUrl && !imgError ? (
              <div
                className={cn(
                  'relative rounded-2xl overflow-hidden border border-border bg-muted cursor-pointer group shadow-md',
                  isSheet && 'mx-auto w-full max-w-[220px] rounded-xl shadow-sm',
                )}
                onClick={() => setImgFullscreen(true)}
              >
                {/* Wrapper com aspect-ratio da imagem original para posicionar bbox com precisão */}
                <div
                  className={cn('relative', isSheet && 'max-h-[160px] w-full')}
                  style={bbox?.image_width && bbox?.image_height
                    ? { aspectRatio: `${bbox.image_width}/${bbox.image_height}` }
                    : undefined}
                >
                  <img
                    src={imageUrl}
                    alt={item.item || 'Imagem do item'}
                    className={cn(
                      'w-full transition-all duration-500 group-hover:scale-105',
                      isSheet
                        ? 'max-h-[160px] h-auto w-full object-contain'
                        : bbox?.image_width && bbox?.image_height
                          ? 'h-full object-contain'
                          : 'h-auto min-h-[200px] max-h-[400px] object-cover',
                    )}
                    onError={() => setImgError(true)}
                  />
                  {(bbox || detecoes.length > 0) && (
                    <YoloOverlayGroup primaryBbox={bbox} detecoes={detecoes} prioridade={item.prioridade} />
                  )}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                  <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-3 py-1.5 text-xs text-white font-medium flex items-center gap-2">
                    <ExternalLink className="w-3.5 h-3.5" /> Clique para ampliar
                  </div>
                </div>
                <div className="absolute top-3 right-3 sm:hidden">
                  <div className="bg-black/50 backdrop-blur-md rounded-lg p-1.5 text-white">
                    <ExternalLink className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-border bg-muted/30 flex flex-col items-center justify-center py-16 text-muted-foreground animate-pulse">
                <ImageIcon className="w-10 h-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">Sem imagem disponível</p>
              </div>
            )}
            {imageUrl && !imgError && item.tipo_entrada !== 'MANUAL' && (
              <YoloDetectionsSummary primaryBbox={bbox} detecoes={detecoes} />
            )}

            {/* Status/Risk Card */}
            <Card className="rounded-2xl border-2 border-border bg-card/50 shadow-sm overflow-hidden">
              <CardContent className="px-3 py-2.5 sm:px-4 sm:py-3 space-y-2.5">
                <div
                  className={cn(
                    'gap-2',
                    isSheet ? 'grid grid-cols-1 sm:grid-cols-2 sm:gap-3' : 'flex flex-col gap-2',
                  )}
                >
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider shrink-0">
                      Grau de Risco
                    </span>
                    <StatusBadge type="risco" value={item.risco} className="h-6 px-2 sm:px-3 shrink-0" />
                  </div>
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider shrink-0">
                      Prioridade
                    </span>
                    <StatusBadge type="prioridade" value={item.prioridade} className="h-6 px-2 sm:px-3 shrink-0" />
                  </div>
                </div>
                <div className="pt-2 border-t border-border flex gap-2">
                  {item.latitude != null && item.longitude != null && (
                    <div className="flex w-full gap-2 min-w-0">
                      <Button variant="outline" size="sm" className="flex-1 min-w-0 h-9 rounded-xl text-xs gap-1.5 border-border hover:bg-muted" asChild>
                        <a href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`} target="_blank" rel="noopener noreferrer">
                          <MapPin className="w-3.5 h-3.5 shrink-0 text-blue-500" /> Google
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 min-w-0 h-9 rounded-xl text-xs gap-1.5 border-border hover:bg-muted" asChild>
                        <a href={`https://waze.com/ul?ll=${item.latitude},${item.longitude}&navigate=yes`} target="_blank" rel="noopener noreferrer">
                          <Navigation className="w-3.5 h-3.5 shrink-0 text-emerald-500" /> Waze
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* YOLO Score + False Positive */}
            <ItemScoreBadge
              scoreNorm={scoreNorm}
              isFalsoPositivo={yoloFeedback?.confirmado === false}
              isSavingFeedback={isSavingFeedback}
              onFalsoPositivo={handleFalsoPositivo}
              className={isSheet ? 'rounded-xl' : undefined}
            />
          </div>
        </div>

        {/* Right Column */}
        <div className={cn(isSheet ? 'space-y-2' : 'lg:col-span-8 space-y-2 lg:space-y-3')}>

          <div className="space-y-2 lg:space-y-3">
            {/* Recorrência */}
            {recorrenciaAtual && recorrenciaAtual.total_ocorrencias > 1 && (
              <Card className="rounded-2xl border-2 border-amber-400/40 bg-amber-50/50 dark:bg-amber-950/20 shadow-none overflow-hidden">
                <CardContent className="px-3 py-2.5 sm:px-4 sm:py-3 flex gap-2.5 items-start">
                  <div className="h-8 w-8 shrink-0 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                    <RotateCcw className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Recorrência detectada</h4>
                    <p className="text-xs text-foreground/80 mt-0.5">
                      Este endereço foi acionado{' '}
                      <strong>{recorrenciaAtual.total_ocorrencias}</strong>{' '}
                      {recorrenciaAtual.total_ocorrencias === 1 ? 'vez' : 'vezes'} nos últimos 30 dias
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Localização */}
            {item.endereco_curto && (
              <Card className="rounded-2xl border-2 border-border bg-accent/30 shadow-none overflow-hidden">
                <CardContent className="px-3 py-2.5 flex gap-2.5 sm:px-4 sm:py-3">
                  <div className="h-9 w-9 shrink-0 rounded-xl bg-background flex items-center justify-center shadow-sm">
                    <MapPin className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">Localização</h4>
                    <p className="text-xs sm:text-sm text-balance leading-relaxed mb-0.5 break-words">{item.endereco_curto}</p>
                    {item.endereco_completo && item.endereco_completo !== item.endereco_curto && (
                      <p className="text-[11px] text-muted-foreground">{item.endereco_completo}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Ação recomendada */}
            {item.acao && (
              <Card className="rounded-2xl border-2 border-primary/20 bg-primary/5 shadow-none overflow-hidden relative isolate">
                <div className="absolute top-0 right-0 p-4 opacity-5 -z-10 rotate-12 scale-150">
                  <AlertTriangle className="w-20 h-20 text-primary" />
                </div>
                <CardContent className="px-3 py-2.5 sm:px-4 sm:py-3">
                  <h4 className="text-xs font-semibold uppercase tracking-widest text-primary mb-1.5 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Ação Recomendada
                  </h4>
                  <p className="text-xs sm:text-sm font-semibold text-foreground leading-relaxed">{item.acao}</p>
                </CardContent>
              </Card>
            )}

            {/* Status/Plano de ação */}
            <ItemPlanoAcao
              itemId={item.id}
              statusLocal={statusLocal}
              acaoAplicadaLocal={acaoAplicadaLocal}
              checkinEm={checkinEm}
              isSaving={isSavingAtendimento}
              onStatusChange={setStatusLocal}
              onAcaoChange={setAcaoAplicadaLocal}
              onCheckinRegistered={setCheckinEm}
              onSave={() => handleSaveAtendimento()}
              onIniciarAtendimento={handleIniciarAtendimento}
              onCancelarAtendimento={handleCancelarAtendimento}
              onConfirmarResolucao={handleConfirmarResolucao}
            />

            {/* Casos notificados próximos */}
            <ItemCasosNotificados itemId={item.id} />

            {/* e-SUS Notifica */}
            <ItemEsusNotifica item={item} />

            {/* Evidências: ocultar em Pendente, readonly em Resolvido */}
            {statusLocal !== 'pendente' && (
              <ItemEvidencias itemId={item.id} readonly={statusLocal === 'resolvido'} />
            )}

            {/* Timeline de auditoria */}
            <ItemSlaTimeline itemId={item.id} />

            {/* Coordenadas */}
            {item.latitude != null && item.longitude != null && (
              <div className="flex items-center gap-2 px-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[10px] text-muted-foreground font-mono">
                  Coordinates: {item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen image modal */}
      {imgFullscreen && imageUrl && (
        <div
          className="fixed inset-0 z-[100] bg-background/95 flex flex-col backdrop-blur-md animate-in fade-in duration-300"
          onClick={() => setImgFullscreen(false)}
        >
          <div className="flex items-center justify-between p-4 sm:px-6 w-full shrink-0 z-50 bg-gradient-to-b from-background/90 to-transparent">
            <div className="flex items-center gap-3">
              <div className="bg-muted/80 border border-border rounded-xl px-3 py-1.5 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-foreground">
                <h3 className="font-bold text-sm sm:text-base">{item.item || 'Detalhes da Imagem'}</h3>
                {item.data_hora && (
                  <>
                    <span className="hidden sm:block text-muted-foreground truncate">•</span>
                    <span className="text-xs text-muted-foreground font-medium">
                      {new Date(item.data_hora).toLocaleString('pt-BR')}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 lg:gap-4 flex-1">
              <div className="hidden sm:flex gap-2 mr-2">
                <StatusBadge type="risco" value={item.risco} />
                <StatusBadge type="prioridade" value={item.prioridade} />
              </div>
              <Button
                variant="outline"
                size="icon"
                className="border-border bg-muted/50 hover:bg-muted shrink-0 h-10 w-10 rounded-full transition-all"
                onClick={(e) => { e.stopPropagation(); setImgFullscreen(false); }}
              >
                <X className="w-5 h-5 lg:w-4 lg:h-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 w-full flex flex-col lg:flex-row pb-4 px-4 sm:px-6 gap-4 lg:gap-6 min-h-0" onClick={(e) => e.stopPropagation()}>
            <div className="flex-1 flex flex-col min-h-0 gap-3 min-w-0">
              <div className="flex-1 flex items-center justify-center min-h-0 relative rounded-2xl overflow-hidden bg-muted/50 border border-border">
                {/* Wrapper com aspect-ratio: garante que bbox_norm se alinha com a imagem renderizada */}
                {bbox?.image_width && bbox?.image_height ? (
                  <div
                    className="relative max-h-full max-w-full"
                    style={{ aspectRatio: `${bbox.image_width}/${bbox.image_height}` }}
                  >
                    <img src={imageUrl} alt={item.item || 'Imagem'} className="w-full h-full object-contain" />
                    <YoloOverlayGroup primaryBbox={bbox} detecoes={detecoes} prioridade={item.prioridade} />
                  </div>
                ) : (
                  <img src={imageUrl} alt={item.item || 'Imagem'} className="w-full h-full object-contain" />
                )}
                <div className="absolute bottom-4 left-4 sm:hidden flex flex-wrap gap-2 pointer-events-none">
                  <StatusBadge type="risco" value={item.risco} />
                  <StatusBadge type="prioridade" value={item.prioridade} />
                </div>
              </div>
              {item.tipo_entrada !== 'MANUAL' && (
                <YoloDetectionsSummary primaryBbox={bbox} detecoes={detecoes} className="shrink-0" />
              )}
            </div>

            <div className="w-full lg:w-[380px] xl:w-[420px] lg:h-full shrink-0 flex flex-col gap-3 lg:gap-4 overflow-y-auto overflow-x-hidden no-scrollbar">
              <div className="bg-card border border-border rounded-2xl p-4 lg:p-5 text-foreground backdrop-blur-md shadow-xl shrink-0">
                <div className="flex items-start gap-3">
                  <div className="mt-1 bg-primary/10 rounded-full p-2 shrink-0 text-primary">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-1">Localização</h4>
                    <p className="text-sm font-medium leading-relaxed truncate whitespace-normal text-foreground">
                      {item.endereco_completo || item.endereco_curto || 'Localização não disponível'}
                    </p>
                    {item.latitude != null && item.longitude != null && (
                      <p className="text-xs text-muted-foreground font-mono mt-2 flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {item.acao && (
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 lg:p-5 text-foreground backdrop-blur-md shadow-xl shrink-0">
                  <h4 className="flex items-center gap-2 text-[10px] lg:text-xs font-bold uppercase tracking-widest text-orange-600 dark:text-orange-400 mb-2.5">
                    <AlertTriangle className="w-4 h-4" /> Ação Recomendada
                  </h4>
                  <p className="text-sm font-medium text-foreground/90 leading-relaxed">{item.acao}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 shrink-0">
                <ModalGridItem icon={<Hash />} label="Score Final" value={scoreNorm != null ? `${Math.round(scoreNorm * 100)}%` : '—'} highlight={scoreNorm != null ? getScoreConfig(scoreNorm).textColor : undefined} />
                <ModalGridItem icon={<Clock />} label="SLA (Horas)" value={item.sla_horas ? `${item.sla_horas}h` : '—'} highlight={item.sla_horas && item.sla_horas < 24 ? 'text-red-600 dark:text-red-400' : undefined} />
                <ModalGridItem icon={<Plane />} label="Aeronave" value={item.drone?.modelo || '—'} />
                <ModalGridItem icon={<Camera />} label="Resolução" value={item.resolucao_largura_px ? `${item.resolucao_largura_px}x${item.resolucao_altura_px}` : '—'} />
                <ModalGridItem icon={<Compass />} label="Altitude" value={item.altitude_m != null ? `${item.altitude_m.toFixed(1)}m` : '—'} />
                <ModalGridItem icon={<Navigation />} label="Direção" value={item.direcao_yaw_graus != null ? `${item.direcao_yaw_graus.toFixed(1)}°` : '—'} />
                <ModalGridItem icon={<ImageIcon className="w-4 h-4" />} label="Pitch" value={item.inclinacao_frontal_pitch_graus != null ? `${item.inclinacao_frontal_pitch_graus.toFixed(1)}°` : '—'} />
                <ModalGridItem icon={<MapPin className="w-4 h-4" />} label="Dist. Focal" value={item.focal_mm ? `${item.focal_mm}mm` : '—'} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* --- Internal Components --- */

const ModalGridItem = ({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string | number; highlight?: string }) => (
  <div className="bg-muted/50 border border-border rounded-xl p-3 flex flex-col justify-center gap-1.5 backdrop-blur-md hover:bg-muted transition-colors">
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <div className="text-muted-foreground [&>svg]:w-3.5 [&>svg]:h-3.5">{icon}</div>
      <span className="text-[9px] uppercase font-bold tracking-wider">{label}</span>
    </div>
    <span className={cn("text-sm font-bold truncate", highlight ?? "text-foreground")}>{value}</span>
  </div>
);

export default ItemDetailPanel;
