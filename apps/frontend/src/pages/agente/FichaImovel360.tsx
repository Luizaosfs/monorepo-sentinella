/**
 * FichaImovel360 — Ficha completa do imóvel para o agente.
 * Rota: /agente/imoveis/:id
 *
 * Consolida em uma única tela:
 *  - Identificação + status operacional
 *  - CTA contextual (Iniciar / Ver / Sem Acesso)
 *  - Focos e denúncias vinculados
 *  - Visitas recentes
 *  - Contexto epidemiológico (casos próximos)
 *  - Perfil de risco do imóvel
 *  - Localização (link para mapa externo)
 *  - Mini-timeline de eventos
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft, AlertCircle, CheckCircle2, Clock, Ban,
  AlertTriangle, Plane, ShieldAlert, MapPin, Stethoscope,
  GitMerge, WifiOff, ChevronRight, Home, MessageSquare,
  Activity, CalendarDays, ClipboardCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { useAuth } from '@/hooks/useAuth';
import { useImovelResumoById } from '@/hooks/queries/useImoveis';
import { carregarRascunhoExiste } from '@/lib/vistoriaRascunho';
import { useVistoriasByImovel } from '@/hooks/queries/useVistorias';
import { useFocosRisco } from '@/hooks/queries/useFocosRisco';
import { useCasosProximosAoPonto } from '@/hooks/queries/useCasosNotificados';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { resolveStatusImovel } from '@/lib/imovelStatus';
import type { FocoRisco, Vistoria, CasoNotificado } from '@/types/database';
import { DimensoesBadges } from '@/components/consolidacao/DimensoesBadges';
import { PrioridadeBadge as PrioridadeConsolidacaoBadge } from '@/components/consolidacao/PrioridadeBadge';
import { ConsolidacaoAnaliticaDetalhe } from '@/components/consolidacao/ConsolidacaoAnaliticaDetalhe';
import { useModoAnalitico } from '@/hooks/useModoAnalitico';

// ── Helpers ──────────────────────────────────────────────────────────────────

const hoje = new Date().toISOString().slice(0, 10);

const STATUS_CFG = {
  visitado: { label: 'Visitado hoje',  color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',   icon: CheckCircle2 },
  pendente: { label: 'Pendente',       color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',           icon: Clock },
  revisita: { label: 'Revisita',       color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',   icon: Clock },
  fechado:  { label: 'Sem acesso',     color: 'bg-gray-100 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400',       icon: Ban },
} as const;

type StatusKey = keyof typeof STATUS_CFG;

const FOCO_STATUS_LABEL: Record<string, string> = {
  suspeita:         'Suspeita',
  em_triagem:       'Em triagem',
  aguarda_inspecao: 'Aguarda inspeção',
  confirmado:       'Confirmado',
  em_tratamento:    'Em tratamento',
  resolvido:        'Resolvido',
  descartado:       'Descartado',
};

const FOCO_STATUS_COLOR: Record<string, string> = {
  suspeita:         'bg-yellow-100 text-yellow-700',
  em_triagem:       'bg-blue-100 text-blue-700',
  aguarda_inspecao: 'bg-amber-100 text-amber-700',
  confirmado:       'bg-red-100 text-red-700',
  em_tratamento:    'bg-orange-100 text-orange-700',
  resolvido:        'bg-green-100 text-green-700',
  descartado:       'bg-gray-100 text-gray-500',
};

const SCORE_BG: Record<string, string> = {
  baixo:     'bg-emerald-100 text-emerald-700',
  medio:     'bg-yellow-100 text-yellow-700',
  alto:      'bg-orange-100 text-orange-700',
  muito_alto:'bg-red-100 text-red-700',
  critico:   'bg-red-200 text-red-900 font-bold',
};

// ── Subcomponentes ────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, className }: { icon: React.ComponentType<{ className?: string }>; title: string; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2 mb-3', className)}>
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">{title}</h2>
    </div>
  );
}

function InfoRow({ label, value, urgent }: { label: string; value: React.ReactNode; urgent?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn('text-sm font-semibold', urgent && 'text-red-600 dark:text-red-400')}>{value}</span>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function FichaImovel360() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { clienteId } = useClienteAtivo();
  const { ativo: modoAnalitico } = useModoAnalitico();
  const { user } = useAuth();

  const { data: imovel, isLoading } = useImovelResumoById(id);
  const { data: vistorias = [] } = useVistoriasByImovel(id);
  const { data: focosPage } = useFocosRisco(clienteId, { imovel_id: id, pageSize: 10 } as never);
  const focos: FocoRisco[] = (focosPage as { items?: FocoRisco[] } | undefined)?.items ?? (Array.isArray(focosPage) ? focosPage as FocoRisco[] : []);
  const { data: casos = [] } = useCasosProximosAoPonto(
    imovel?.latitude ?? null,
    imovel?.longitude ?? null,
    clienteId,
  );
  const { pendingCount } = useOfflineQueue();

  const [temRascunho, setTemRascunho] = useState(false);
  useEffect(() => {
    if (!user?.id || !imovel) return;
    carregarRascunhoExiste(imovel.id, user.id).then(setTemRascunho);
  }, [imovel?.id, user?.id]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (!imovel) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8 text-center">
        <Home className="w-12 h-12 text-muted-foreground/40" />
        <p className="text-muted-foreground">Imóvel não encontrado.</p>
        <Button variant="outline" onClick={() => navigate(-1)}>Voltar</Button>
      </div>
    );
  }

  // ── Dados derivados ────────────────────────────────────────────────────────
  const statusKey = resolveStatusImovel(imovel, hoje);
  const cfg = STATUS_CFG[statusKey];
  const StatusIcon = cfg.icon;
  const endereco = [imovel.logradouro, imovel.numero].filter(Boolean).join(', ') || 'Endereço não informado';
  const enderecoComplemento = [imovel.complemento, imovel.bairro, imovel.quarteirao ? `Q. ${imovel.quarteirao}` : null].filter(Boolean).join(' · ');

  const focosCidadao = focos.filter((f) => f.origem_tipo === 'cidadao');
  const focosNormais = focos.filter((f) => f.origem_tipo !== 'cidadao');
  const vistoriasRecentes = vistorias.slice(0, 5);
  const jaVisitadoHoje = statusKey === 'visitado';
  const temFocos = imovel.focos_ativos > 0 || focos.length > 0;
  const casosProximos = (casos as CasoNotificado[]).slice(0, 3);

  // CTA contextual
  const ctaLabel = jaVisitadoHoje
    ? 'Ver Vistoria do Dia'
    : temRascunho
    ? 'Continuar Vistoria'
    : imovel.focos_ativos > 0
    ? 'Iniciar Vistoria (foco ativo)'
    : 'Iniciar Vistoria';

  const ctaVariant = jaVisitadoHoje ? 'outline' : 'default';
  const ctaAction = () => navigate(`/agente/vistoria/${imovel.id}`);

  // Timeline derivada de vistorias + focos
  type TimelineEvt = { date: string; label: string; color: string };
  const timelineEvents: TimelineEvt[] = [
    ...vistoriasRecentes.map((v: Vistoria) => ({
      date: v.data_visita,
      label: v.status === 'visitado' ? 'Vistoria realizada'
           : v.status === 'revisita' ? 'Sem acesso — revisita agendada'
           : v.status === 'fechado'  ? 'Imóvel fechado'
           : 'Visita registrada',
      color: v.status === 'visitado' ? 'bg-green-500' : v.status === 'revisita' ? 'bg-amber-500' : 'bg-gray-400',
    })),
    ...focosNormais.slice(0, 5).map((f: FocoRisco) => ({
      date: f.created_at,
      label: `Foco ${FOCO_STATUS_LABEL[f.status] ?? f.status}`,
      color: f.status === 'resolvido' ? 'bg-green-500' : 'bg-red-500',
    })),
    ...focosCidadao.map((f: FocoRisco) => ({
      date: f.created_at,
      label: 'Denúncia registrada',
      color: 'bg-violet-500',
    })),
  ].sort((a, b) => (b.date > a.date ? 1 : -1)).slice(0, 8);

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Cabeçalho sticky ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border/60 px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="shrink-0 -ml-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-foreground truncate leading-tight">{endereco}</p>
          {enderecoComplemento && (
            <p className="text-xs text-muted-foreground truncate">{enderecoComplemento}</p>
          )}
        </div>
        {imovel.score_classificacao && imovel.score_territorial != null && (
          <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full shrink-0', SCORE_BG[imovel.score_classificacao] ?? 'bg-muted text-muted-foreground')}>
            {imovel.score_territorial}
          </span>
        )}
      </div>

      {/* ── Conteúdo scrollável ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 pb-36">

        {/* ── Banner de status ──────────────────────────────────────────── */}
        <div className={cn('flex items-center gap-3 rounded-xl px-4 py-3', cfg.color)}>
          <StatusIcon className="w-5 h-5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">{cfg.label}</p>
            {imovel.ultima_visita && (
              <p className="text-xs opacity-80">
                Última visita: {format(new Date(imovel.ultima_visita), "d 'de' MMM 'de' yyyy", { locale: ptBR })}
              </p>
            )}
          </div>
          {imovel.focos_ativos > 0 && (
            <span className="shrink-0 inline-flex items-center gap-1 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              <AlertCircle className="w-3 h-3" />{imovel.focos_ativos} foco{imovel.focos_ativos > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* ── Aviso offline ─────────────────────────────────────────────── */}
        {pendingCount > 0 && (
          <div className="flex items-center gap-2.5 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 px-4 py-2.5">
            <WifiOff className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-400 font-medium flex-1">
              {pendingCount} operação{pendingCount > 1 ? 'ões' : ''} pendente{pendingCount > 1 ? 's' : ''} de sincronização
            </p>
          </div>
        )}

        {/* ── Situação operacional ─────────────────────────────────────── */}
        <div className="rounded-xl border border-border/60 p-4 space-y-0">
          <SectionHeader icon={Activity} title="Situação operacional" />
          <InfoRow label="Total de vistorias" value={imovel.total_vistorias} />
          <InfoRow label="Tentativas sem acesso (90 dias)" value={imovel.tentativas_sem_acesso} urgent={imovel.tentativas_sem_acesso >= 2} />
          <InfoRow label="Focos ativos" value={imovel.focos_ativos} urgent={imovel.focos_ativos > 0} />
          <InfoRow label="Focos reincidentes (180 dias)" value={imovel.focos_recorrentes} urgent={imovel.focos_recorrentes > 0} />
          <InfoRow label="Total focos histórico" value={imovel.total_focos_historico} />
          {imovel.slas_abertos > 0 && (
            <div className="flex items-center gap-2 pt-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-bold text-red-600 dark:text-red-400">
                {imovel.slas_abertos} SLA{imovel.slas_abertos > 1 ? 's' : ''} em aberto
              </span>
            </div>
          )}
        </div>

        {/* ── Focos de risco ────────────────────────────────────────────── */}
        {temFocos && (
          <div className="rounded-xl border border-border/60 p-4">
            <SectionHeader icon={AlertTriangle} title="Focos de risco" />
            {focosNormais.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">Nenhum foco registrado.</p>
            ) : (
              <div className="space-y-2">
                {focosNormais.map((f: FocoRisco) => (
                  <div key={f.id} className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2">
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', FOCO_STATUS_COLOR[f.status] ?? 'bg-muted text-muted-foreground')}>
                      {FOCO_STATUS_LABEL[f.status] ?? f.status}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground truncate">
                        {f.descricao || 'Sem descrição'} · {formatDistanceToNow(new Date(f.created_at), { locale: ptBR, addSuffix: true })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7 shrink-0"
                      onClick={() => navigate(`/agente/focos/${f.id}`)}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Denúncias de cidadão ─────────────────────────────────────── */}
        {focosCidadao.length > 0 && (
          <div className="rounded-xl border border-violet-200 dark:border-violet-800/40 p-4">
            <SectionHeader icon={MessageSquare} title="Denúncias vinculadas" className="text-violet-700 dark:text-violet-400" />
            <div className="space-y-2">
              {focosCidadao.map((f: FocoRisco) => (
                <div key={f.id} className="flex items-center gap-3 rounded-lg bg-violet-50 dark:bg-violet-950/20 px-3 py-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 shrink-0">
                    Cidadão
                  </span>
                  <p className="text-xs text-muted-foreground flex-1 truncate">
                    {f.descricao || 'Denúncia recebida'} · {formatDistanceToNow(new Date(f.created_at), { locale: ptBR, addSuffix: true })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Visitas recentes ──────────────────────────────────────────── */}
        <div className="rounded-xl border border-border/60 p-4">
          <SectionHeader icon={CalendarDays} title="Visitas recentes" />
          {vistoriasRecentes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">Nenhuma visita registrada.</p>
          ) : (
            <div className="space-y-3">
              {vistoriasRecentes.map((v: Vistoria) => {
                const statusV = v.status === 'visitado' ? { label: 'Realizada',  color: 'bg-green-100 text-green-700' }
                              : v.status === 'revisita' ? { label: 'Sem acesso', color: 'bg-amber-100 text-amber-700' }
                              : v.status === 'fechado'  ? { label: 'Fechado',    color: 'bg-gray-100 text-gray-500' }
                              : { label: 'Pendente', color: 'bg-blue-100 text-blue-700' };
                return (
                  <div
                    key={v.id}
                    className={cn(
                      'rounded-lg border overflow-hidden',
                      v.prioridade_final === 'P1' && 'border-red-300 bg-red-50/40 dark:bg-red-950/20 dark:border-red-800/50',
                      v.prioridade_final === 'P2' && 'border-orange-300 bg-orange-50/40 dark:bg-orange-950/20 dark:border-orange-800/50',
                      (!v.prioridade_final || !['P1','P2'].includes(v.prioridade_final)) && 'border-border/50',
                    )}
                  >
                    {/* cabeçalho: status, data, badge de prioridade */}
                    <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0', statusV.color)}>
                        {statusV.label}
                      </span>
                      <p className="text-xs text-muted-foreground flex-1">
                        {format(new Date(v.data_visita), "d 'de' MMM", { locale: ptBR })}
                        {v.tipo_atividade ? ` · ${v.tipo_atividade}` : ''}
                      </p>
                      <PrioridadeConsolidacaoBadge prioridade={v.prioridade_final} size="sm" />
                    </div>
                    {/* dimensões analíticas + resultado operacional + incompleto */}
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
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Contexto epidemiológico ───────────────────────────────────── */}
        {casosProximos.length > 0 && (
          <div className="rounded-xl border border-red-200 dark:border-red-800/40 p-4">
            <SectionHeader icon={Stethoscope} title="Casos notificados próximos" />
            <div className="space-y-2">
              {casosProximos.map((c: CasoNotificado) => (
                <div key={c.id} className="flex items-center gap-3 rounded-lg bg-red-50 dark:bg-red-950/20 px-3 py-2">
                  <GitMerge className="w-4 h-4 text-red-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-red-700 dark:text-red-400 capitalize">{c.doenca}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {c.status} · {formatDistanceToNow(new Date(c.created_at), { locale: ptBR, addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Perfil do imóvel ──────────────────────────────────────────── */}
        {(imovel.historico_recusa || imovel.prioridade_drone || (imovel.tem_calha && !imovel.calha_acessivel)) && (
          <div className="rounded-xl border border-border/60 p-4">
            <SectionHeader icon={ShieldAlert} title="Perfil do imóvel" />
            {imovel.historico_recusa && (
              <div className="flex items-center gap-2 py-1.5">
                <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
                <span className="text-sm text-red-700 dark:text-red-400 font-medium">Histórico de recusa de acesso</span>
              </div>
            )}
            {imovel.prioridade_drone && (
              <div className="flex items-center gap-2 py-1.5">
                <Plane className="w-4 h-4 text-blue-500 shrink-0" />
                <span className="text-sm text-blue-700 dark:text-blue-400 font-medium">Marcado para sobrevoo de drone</span>
              </div>
            )}
            {imovel.tem_calha && !imovel.calha_acessivel && (
              <div className="flex items-center gap-2 py-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-sm text-amber-700 dark:text-amber-400 font-medium">Calha presente e inacessível</span>
              </div>
            )}
          </div>
        )}

        {/* ── Localização ───────────────────────────────────────────────── */}
        {imovel.latitude && imovel.longitude && (
          <div className="rounded-xl border border-border/60 p-4">
            <SectionHeader icon={MapPin} title="Localização" />
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {imovel.latitude.toFixed(6)}, {imovel.longitude.toFixed(6)}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() =>
                  window.open(
                    `https://maps.google.com/?q=${imovel.latitude},${imovel.longitude}`,
                    '_blank',
                  )
                }
              >
                <MapPin className="w-3.5 h-3.5" />
                Abrir no Maps
              </Button>
            </div>
          </div>
        )}

        {/* ── Timeline resumida ─────────────────────────────────────────── */}
        {timelineEvents.length > 0 && (
          <div className="rounded-xl border border-border/60 p-4">
            <SectionHeader icon={ClipboardCheck} title="Timeline" />
            <div className="space-y-2">
              {timelineEvents.map((evt, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex flex-col items-center shrink-0 pt-1">
                    <span className={cn('w-2 h-2 rounded-full', evt.color)} />
                    {i < timelineEvents.length - 1 && <div className="w-px flex-1 bg-border/60 mt-1 min-h-[16px]" />}
                  </div>
                  <div className="pb-2">
                    <p className="text-sm font-medium text-foreground leading-tight">{evt.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(evt.date), { locale: ptBR, addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator />
        <p className="text-[11px] text-muted-foreground text-center pb-2">
          ID: {imovel.id.slice(0, 8)} · Atualizado {imovel.updated_at ? formatDistanceToNow(new Date(imovel.updated_at), { locale: ptBR, addSuffix: true }) : '—'}
        </p>
      </div>

      {/* ── CTAs fixos na base ────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border/60 px-4 pb-6 pt-3 space-y-2 z-20">
        <Button
          className={cn('w-full h-12 font-bold rounded-xl', imovel.focos_ativos > 0 && !jaVisitadoHoje && 'bg-red-600 hover:bg-red-700')}
          variant={ctaVariant}
          onClick={ctaAction}
        >
          {ctaLabel}
        </Button>
        {!jaVisitadoHoje && (
          <Button
            variant="outline"
            className="w-full h-10 rounded-xl border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 font-semibold"
            onClick={() => navigate(`/agente/vistoria/${imovel.id}?modo=sem-acesso`)}
          >
            Registrar Sem Acesso
          </Button>
        )}
      </div>
    </div>
  );
}
