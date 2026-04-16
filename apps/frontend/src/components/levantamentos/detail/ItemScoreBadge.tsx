import { TrendingUp, Loader2, ThumbsDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function normalizeScore(raw: number | null | undefined): number | null {
  if (raw == null) return null;
  return raw > 1 ? raw / 100 : raw;
}

/**
 * Mapeia score YOLO normalizado (0–1) para prioridade operacional sugerida.
 *
 * Regra canônica (CLAUDE.md):
 *   >= 0.85 → Alta      (alta certeza de foco real — atendimento prioritário)
 *   >= 0.65 → Média     (provável foco — vistoria recomendada)
 *   >= 0.45 → Baixa     (incerto — confirmar em campo)
 *    < 0.45 → Monitoramento (baixa certeza — não bloquear SLA)
 *
 * ATENÇÃO: esta função retorna uma SUGESTÃO. A prioridade real do item é definida
 * pelo pipeline Python e armazenada em levantamento_itens.prioridade — nunca
 * sobrescrever a prioridade real com este valor sem intervenção do usuário.
 */
export function scoreToPrioridadeSugerida(
  score: number | null | undefined,
): 'Alta' | 'Média' | 'Baixa' | 'Monitoramento' | null {
  if (score == null) return null;
  const s = score > 1 ? score / 100 : score; // normaliza se necessário
  if (s >= 0.85) return 'Alta';
  if (s >= 0.65) return 'Média';
  if (s >= 0.45) return 'Baixa';
  return 'Monitoramento';
}

export function getScoreConfig(score: number): { label: string; barColor: string; textColor: string } {
  if (score >= 0.85) return { label: 'Muito alta', barColor: 'bg-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400' };
  if (score >= 0.65) return { label: 'Alta',       barColor: 'bg-blue-500',    textColor: 'text-blue-600 dark:text-blue-400' };
  if (score >= 0.45) return { label: 'Média',      barColor: 'bg-amber-500',   textColor: 'text-amber-600 dark:text-amber-400' };
  if (score >= 0.25) return { label: 'Baixa',      barColor: 'bg-orange-500',  textColor: 'text-orange-600 dark:text-orange-400' };
  return               { label: 'Muito baixa',      barColor: 'bg-red-500',     textColor: 'text-red-600 dark:text-red-400' };
}

interface ItemScoreBadgeProps {
  scoreNorm: number | null;
  /** Whether the item has a false-positive flag */
  isFalsoPositivo: boolean;
  isSavingFeedback: boolean;
  onFalsoPositivo: () => void;
  className?: string;
}

export function ItemScoreBadge({
  scoreNorm,
  isFalsoPositivo,
  isSavingFeedback,
  onFalsoPositivo,
  className,
}: ItemScoreBadgeProps) {
  return (
    <Card className={cn('rounded-2xl border-2 border-border bg-card/50 shadow-sm overflow-hidden', className)}>
      <CardContent className="px-3 py-2.5 sm:px-4 sm:py-3 space-y-2">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <span className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5 min-w-0">
            <TrendingUp className="w-3.5 h-3.5 shrink-0" /> Confiança YOLO
          </span>
          {scoreNorm != null ? (
            <span className={cn('text-sm font-bold shrink-0', getScoreConfig(scoreNorm).textColor)}>
              {Math.round(scoreNorm * 100)}%
            </span>
          ) : (
            <span className="text-[10px] bg-muted rounded-full px-2 py-0.5 text-muted-foreground font-medium">
              Entrada manual
            </span>
          )}
        </div>
        {scoreNorm != null ? (
          <>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-700', getScoreConfig(scoreNorm).barColor)}
                style={{ width: `${Math.round(scoreNorm * 100)}%` }}
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-2 min-w-0">
              <p className={cn('text-[10px] font-semibold uppercase tracking-wider shrink-0', getScoreConfig(scoreNorm).textColor)}>
                {getScoreConfig(scoreNorm).label}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  'h-auto min-h-6 px-2 py-1 text-[10px] gap-1 rounded-lg shrink-0 sm:max-w-none max-w-full',
                  isFalsoPositivo
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 hover:bg-rose-200'
                    : 'text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20'
                )}
                onClick={onFalsoPositivo}
                disabled={isSavingFeedback}
                title="Marcar como não confirmado em campo (falso positivo)"
              >
                {isSavingFeedback ? <Loader2 className="w-3 h-3 animate-spin" /> : <ThumbsDown className="w-3 h-3" />}
                {isFalsoPositivo ? 'Falso positivo' : 'Não confirmado'}
              </Button>
            </div>
          </>
        ) : (
          <p className="text-[10px] text-muted-foreground">Sem análise automática disponível</p>
        )}
      </CardContent>
    </Card>
  );
}
