/**
 * ConsolidacaoBlock — Bloco completo de consolidação de vistoria.
 *
 * Exibe:
 *  • Prioridade final (P1–P5) com badge colorido
 *  • Motivo da prioridade
 *  • Dimensão dominante (se houver)
 *  • Badges das 4 dimensões
 *  • Aviso de dados incompletos (consolidacao_incompleta = true)
 *  • Data de consolidação
 *
 * Não exibe consolidacao_json bruto.
 */
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { PrioridadeBadge } from './PrioridadeBadge';
import { DimensoesBadges } from './DimensoesBadges';
import type { Vistoria } from '@/types/database';

// ── Mapa de dimensão dominante → label legível ───────────────────────────────
const DIMENSAO_LABEL: Record<string, string> = {
  alerta_saude:              'Alerta de saúde',
  risco_vetorial:            'Risco vetorial',
  vulnerabilidade_domiciliar:'Vulnerabilidade domiciliar',
  risco_socioambiental:      'Risco socioambiental',
  resultado_operacional:     'Sem acesso',
};

// ── Props ────────────────────────────────────────────────────────────────────

type ConsolidacaoBlockProps = Pick<
  Vistoria,
  | 'prioridade_final'
  | 'prioridade_motivo'
  | 'dimensao_dominante'
  | 'resultado_operacional'
  | 'vulnerabilidade_domiciliar'
  | 'alerta_saude'
  | 'risco_socioambiental'
  | 'risco_vetorial'
  | 'consolidacao_incompleta'
  | 'consolidacao_resumo'
  | 'consolidado_em'
> & {
  /** 'compact' mostra apenas prioridade + dimensões | 'full' mostra tudo */
  variant?: 'compact' | 'full';
  className?: string;
};

// ── Componente ───────────────────────────────────────────────────────────────

export function ConsolidacaoBlock({
  prioridade_final,
  prioridade_motivo,
  dimensao_dominante,
  resultado_operacional,
  vulnerabilidade_domiciliar,
  alerta_saude,
  risco_socioambiental,
  risco_vetorial,
  consolidacao_incompleta,
  consolidacao_resumo,
  consolidado_em,
  variant = 'full',
  className,
}: ConsolidacaoBlockProps) {
  const [expandido, setExpandido] = useState(false);

  // Sem consolidação ainda
  if (!prioridade_final) {
    return (
      <div className={cn('rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground', className)}>
        Consolidação pendente
      </div>
    );
  }

  // ── Variante compacta (para listas) ───────────────────────────────────────
  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-2 flex-wrap', className)}>
        <PrioridadeBadge prioridade={prioridade_final} size="sm" />
        <DimensoesBadges
          resultado_operacional={resultado_operacional ?? undefined}
          vulnerabilidade_domiciliar={vulnerabilidade_domiciliar ?? undefined}
          alerta_saude={alerta_saude ?? undefined}
          risco_socioambiental={risco_socioambiental ?? undefined}
          risco_vetorial={risco_vetorial ?? undefined}
        />
        {consolidacao_incompleta && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-3 h-3" />
            Incompleto
          </span>
        )}
      </div>
    );
  }

  // ── Variante completa ─────────────────────────────────────────────────────
  const dimLabel = dimensao_dominante ? DIMENSAO_LABEL[dimensao_dominante] ?? dimensao_dominante : null;

  return (
    <div className={cn('rounded-xl border border-border/60 overflow-hidden', className)}>
      {/* Cabeçalho: prioridade + toggle */}
      <button
        onClick={() => setExpandido((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        <PrioridadeBadge prioridade={prioridade_final} size="md" />

        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground leading-tight truncate">
            {prioridade_motivo ?? 'Consolidação realizada'}
          </p>
          {dimLabel && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Dimensão dominante: {dimLabel}
            </p>
          )}
        </div>

        {expandido
          ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        }
      </button>

      {/* Alerta de incompletude — sempre visível quando relevante */}
      {consolidacao_incompleta && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950/20 border-t border-amber-200 dark:border-amber-800/40">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
            Dados incompletos — revisar vistoria
          </p>
        </div>
      )}

      {/* Corpo expansível */}
      {expandido && (
        <div className="px-4 py-3 space-y-3 border-t border-border/40">

          {/* Dimensões analíticas + resultado operacional */}
          <DimensoesBadges
            resultado_operacional={resultado_operacional ?? undefined}
            vulnerabilidade_domiciliar={vulnerabilidade_domiciliar ?? undefined}
            alerta_saude={alerta_saude ?? undefined}
            risco_socioambiental={risco_socioambiental ?? undefined}
            risco_vetorial={risco_vetorial ?? undefined}
            hideNull={false}
          />

          {/* Resumo técnico */}
          {consolidacao_resumo && (
            <p className="text-[11px] font-mono text-muted-foreground bg-muted/40 rounded px-2 py-1 break-all">
              {consolidacao_resumo}
            </p>
          )}

          {/* Rodapé */}
          {consolidado_em && (
            <p className="text-[11px] text-muted-foreground">
              Consolidado{' '}
              {formatDistanceToNow(new Date(consolidado_em), { locale: ptBR, addSuffix: true })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
