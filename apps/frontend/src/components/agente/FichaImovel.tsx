/**
 * FichaImovel — Ficha 360° do imóvel para o agente.
 * Abre como bottom sheet ao clicar em um imóvel no "Meu Dia".
 * Usa dados de v_imovel_resumo (ImovelResumo) — sem chamada extra ao banco.
 */
import {
  X, AlertCircle, CheckCircle2, Clock, Ban,
  AlertTriangle, Plane, ShieldAlert, ChevronRight,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { ImovelResumo } from '@/types/database';
import { useAuth } from '@/hooks/useAuth';
import { carregarRascunhoExiste } from '@/lib/vistoriaRascunho';
import { resolveStatusImovel } from '@/lib/imovelStatus';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  visitado: { label: 'Visitado',  color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',  icon: CheckCircle2 },
  pendente: { label: 'Pendente',  color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',          icon: Clock },
  revisita: { label: 'Revisita',  color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',  icon: Clock },
  fechado:  { label: 'Fechado',   color: 'bg-gray-100 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400',      icon: Ban },
} as const;

type StatusKey = keyof typeof STATUS_CONFIG;

const SCORE_BADGE: Record<string, string> = {
  alto:      'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  muito_alto:'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  critico:   'bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-200 font-bold',
};

// ─── Subcomponentes ──────────────────────────────────────────────────────────

function StatRow({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn('text-sm font-semibold text-foreground', highlight && 'text-red-600 dark:text-red-400')}>
        {value}
      </span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
      {children}
    </p>
  );
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface FichaImovelProps {
  imovel: ImovelResumo | null;
  hoje: string;
  onClose: () => void;
  onIniciarVistoria: (id: string) => void;
  onSemAcesso: (id: string) => void;
}

// ─── Componente ──────────────────────────────────────────────────────────────

export function FichaImovel({
  imovel,
  hoje,
  onClose,
  onIniciarVistoria,
  onSemAcesso,
}: FichaImovelProps) {
  const navigate = useNavigate();
  const { usuario } = useAuth();

  const [temRascunho, setTemRascunho] = useState(false);
  useEffect(() => {
    if (!usuario?.id || !imovel) return;
    carregarRascunhoExiste(imovel.id, usuario.id).then(setTemRascunho);
  }, [imovel?.id, usuario?.id]);

  if (!imovel) return null;
  const statusKey = resolveStatusImovel(imovel, hoje);
  const cfg = STATUS_CONFIG[statusKey];
  const Icon = cfg.icon;
  const scoreClass = imovel.score_classificacao ? SCORE_BADGE[imovel.score_classificacao] : null;
  const jaVisitadoHoje = statusKey === 'visitado';

  const ultimaVisitaFormatada = imovel.ultima_visita
    ? new Date(imovel.ultima_visita).toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : 'Nenhuma visita registrada';

  const temFocos     = imovel.focos_ativos > 0 || imovel.focos_recorrentes > 0 || imovel.total_focos_historico > 0;
  const temPerfil    = imovel.historico_recusa || imovel.prioridade_drone;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-[2000]"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-[2001] bg-background rounded-t-2xl shadow-2xl max-h-[90dvh] flex flex-col">

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2 shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 pb-2 space-y-4">

          {/* ── Cabeçalho ── */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', cfg.color)}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-foreground leading-tight">
                  {imovel.logradouro ?? 'Endereço não informado'}
                  {imovel.numero ? `, ${imovel.numero}` : ''}
                  {imovel.complemento ? ` — ${imovel.complemento}` : ''}
                </p>
                <p className="text-sm text-muted-foreground">
                  {imovel.bairro ?? '—'}
                  {imovel.quarteirao ? ` · Quarteirão ${imovel.quarteirao}` : ''}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors mt-0.5"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* ── Badges ── */}
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className={cn('text-xs', cfg.color)}>
              {cfg.label}
            </Badge>

            {imovel.focos_ativos > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2.5 py-0.5 text-xs font-bold text-red-700 dark:text-red-400">
                <AlertCircle className="w-3 h-3" />
                {imovel.focos_ativos} foco{imovel.focos_ativos > 1 ? 's' : ''} ativo{imovel.focos_ativos > 1 ? 's' : ''}
              </span>
            )}

            {imovel.focos_recorrentes > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                ↩ {imovel.focos_recorrentes} reincidente{imovel.focos_recorrentes > 1 ? 's' : ''}
              </span>
            )}

            {scoreClass && imovel.score_territorial != null && (
              <span className={cn('rounded-full px-2.5 py-0.5 text-xs', scoreClass)}>
                Score {imovel.score_territorial}
              </span>
            )}
          </div>

          <Separator />

          {/* ── Visitas ── */}
          <div>
            <SectionTitle>Visitas</SectionTitle>
            <StatRow label="Total de vistorias" value={imovel.total_vistorias} />
            <StatRow label="Última visita" value={ultimaVisitaFormatada} />
            <StatRow
              label="Sem acesso (90 dias)"
              value={imovel.tentativas_sem_acesso}
              highlight={imovel.tentativas_sem_acesso >= 2}
            />
          </div>

          {/* ── Focos ── */}
          {temFocos && (
            <>
              <Separator />
              <div>
                <SectionTitle>Focos</SectionTitle>
                <StatRow
                  label="Focos ativos"
                  value={imovel.focos_ativos}
                  highlight={imovel.focos_ativos > 0}
                />
                <StatRow
                  label="Reincidentes (180 dias)"
                  value={imovel.focos_recorrentes}
                  highlight={imovel.focos_recorrentes > 0}
                />
                <StatRow label="Histórico total" value={imovel.total_focos_historico} />
              </div>
            </>
          )}

          {/* ── SLA ── */}
          {imovel.slas_abertos > 0 && (
            <>
              <Separator />
              <div>
                <SectionTitle>SLA</SectionTitle>
                <div className="flex items-center gap-2 py-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                    {imovel.slas_abertos} SLA{imovel.slas_abertos > 1 ? 's' : ''} em aberto
                  </span>
                </div>
              </div>
            </>
          )}

          {/* ── Perfil ── */}
          {temPerfil && (
            <>
              <Separator />
              <div>
                <SectionTitle>Perfil do imóvel</SectionTitle>
                {imovel.historico_recusa && (
                  <div className="flex items-center gap-2 py-1.5">
                    <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
                    <span className="text-sm text-red-700 dark:text-red-400 font-medium">
                      Histórico de recusa de acesso
                    </span>
                  </div>
                )}
                {imovel.prioridade_drone && (
                  <div className="flex items-center gap-2 py-1.5">
                    <Plane className="w-4 h-4 text-blue-500 shrink-0" />
                    <span className="text-sm text-blue-700 dark:text-blue-400 font-medium">
                      Marcado para sobrevoo de drone
                    </span>
                  </div>
                )}
                {imovel.tem_calha && !imovel.calha_acessivel && (
                  <div className="flex items-center gap-2 py-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="text-sm text-amber-700 dark:text-amber-400 font-medium">
                      Calha presente e inacessível
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Botões — fixos na base ── */}
        <div className="shrink-0 px-5 pb-6 pt-3 space-y-2 border-t border-border/60 bg-background">
          <Button
            variant="ghost"
            className="w-full h-8 text-xs text-muted-foreground gap-1 justify-center"
            onClick={() => { onClose(); navigate(`/agente/imoveis/${imovel.id}`); }}
          >
            Ver ficha completa <ChevronRight className="w-3.5 h-3.5" />
          </Button>
          {!jaVisitadoHoje && (
            <Button
              variant="outline"
              className="w-full h-11 rounded-xl border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30 font-semibold"
              onClick={() => onSemAcesso(imovel.id)}
            >
              Registrar Sem Acesso
            </Button>
          )}
          <Button
            className="w-full h-12 font-bold rounded-xl"
            variant={jaVisitadoHoje ? 'outline' : 'default'}
            onClick={() =>
              jaVisitadoHoje
                ? (onClose(), navigate(`/agente/imoveis/${imovel.id}`))
                : onIniciarVistoria(imovel.id)
            }
          >
            {jaVisitadoHoje
              ? 'Ver Vistoria do Dia'
              : temRascunho
              ? 'Continuar Vistoria'
              : 'Iniciar Vistoria'}
          </Button>
        </div>
      </div>
    </>
  );
}
