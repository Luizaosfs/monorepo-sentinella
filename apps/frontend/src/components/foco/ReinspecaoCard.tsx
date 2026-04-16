import { CalendarClock, CheckCircle2, XCircle, AlertTriangle, Clock, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ReinspecaoProgramada, ReinspecaoComFoco } from '@/types/database';
import { LABEL_REINSPECAO_STATUS, LABEL_REINSPECAO_RESULTADO, LABEL_REINSPECAO_TIPO } from '@/types/database';

// ── Helpers visuais ───────────────────────────────────────────────────────────

const STATUS_ICON: Record<string, React.ElementType> = {
  pendente:  Clock,
  realizada: CheckCircle2,
  cancelada: XCircle,
  vencida:   AlertTriangle,
};

const STATUS_COLOR: Record<string, string> = {
  pendente:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  realizada: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  cancelada: 'bg-gray-100 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400',
  vencida:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const RESULTADO_COLOR: Record<string, string> = {
  resolvido:     'text-green-600 dark:text-green-400',
  persiste:      'text-amber-600 dark:text-amber-400',
  nao_realizado: 'text-gray-500 dark:text-gray-400',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function isVencendo(dataPrevista: string): boolean {
  const diff = new Date(dataPrevista).getTime() - Date.now();
  return diff > 0 && diff < 24 * 60 * 60 * 1000; // < 24h
}

// ── Componente ────────────────────────────────────────────────────────────────

interface Props {
  reinspecao: ReinspecaoProgramada | ReinspecaoComFoco;
  /** Mostra endereço do foco (útil no dashboard do agente). */
  showFoco?: boolean;
  /** Ação ao clicar no card (navegar para página de execução). */
  onExecutar?: () => void;
  /** Ação de reagendar (supervisor). */
  onReagendar?: () => void;
  /** Ação de cancelar (supervisor). */
  onCancelar?: () => void;
  className?: string;
}

export function ReinspecaoCard({
  reinspecao,
  showFoco = false,
  onExecutar,
  onReagendar,
  onCancelar,
  className,
}: Props) {
  const Icon = STATUS_ICON[reinspecao.status] ?? Clock;
  const comFoco = reinspecao as ReinspecaoComFoco;
  const alertaVencendo = reinspecao.status === 'pendente' && isVencendo(reinspecao.data_prevista);
  const executavel = reinspecao.status === 'pendente' || reinspecao.status === 'vencida';

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-3 space-y-2',
        reinspecao.status === 'vencida' && 'border-red-300 dark:border-red-700',
        alertaVencendo && 'border-amber-300 dark:border-amber-700',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold shrink-0', STATUS_COLOR[reinspecao.status])}>
            <Icon className="w-3 h-3" />
            {LABEL_REINSPECAO_STATUS[reinspecao.status]}
          </span>
          <span className="text-xs text-muted-foreground truncate">
            {LABEL_REINSPECAO_TIPO[reinspecao.tipo]}
          </span>
        </div>
        {reinspecao.origem === 'manual' && (
          <Badge variant="outline" className="text-[10px] h-4 shrink-0">Manual</Badge>
        )}
      </div>

      {/* Foco (quando showFoco=true) */}
      {showFoco && comFoco.foco_endereco && (
        <p className="text-xs font-medium truncate">
          {comFoco.foco_endereco}
          {comFoco.foco_bairro && <span className="text-muted-foreground"> · {comFoco.foco_bairro}</span>}
        </p>
      )}

      {/* Datas */}
      <div className="text-xs text-muted-foreground space-y-0.5">
        <div className="flex items-center gap-1">
          <CalendarClock className="w-3 h-3 shrink-0" />
          <span className={cn(alertaVencendo && 'text-amber-600 dark:text-amber-400 font-semibold')}>
            Prevista: {formatDate(reinspecao.data_prevista)}
          </span>
          {alertaVencendo && <span className="text-amber-600 dark:text-amber-400 font-semibold text-[10px]">· vence hoje</span>}
        </div>
        {reinspecao.data_realizada && (
          <div>Realizada: {formatDate(reinspecao.data_realizada)}</div>
        )}
      </div>

      {/* Resultado */}
      {reinspecao.resultado && (
        <p className={cn('text-xs font-semibold', RESULTADO_COLOR[reinspecao.resultado])}>
          Resultado: {LABEL_REINSPECAO_RESULTADO[reinspecao.resultado]}
        </p>
      )}

      {/* Observação */}
      {reinspecao.observacao && (
        <p className="text-xs text-muted-foreground line-clamp-2">{reinspecao.observacao}</p>
      )}

      {/* Motivo cancelamento */}
      {reinspecao.motivo_cancelamento && (
        <p className="text-xs text-muted-foreground italic">{reinspecao.motivo_cancelamento}</p>
      )}

      {/* Ações */}
      {(onExecutar || onReagendar || onCancelar) && (
        <div className="flex gap-1.5 pt-1">
          {onExecutar && executavel && (
            <Button size="sm" className="h-7 px-3 text-xs flex-1" onClick={onExecutar}>
              <ChevronRight className="w-3.5 h-3.5 mr-1" />
              Executar reinspeção
            </Button>
          )}
          {onReagendar && executavel && (
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={onReagendar}>
              Reagendar
            </Button>
          )}
          {onCancelar && executavel && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:text-destructive" onClick={onCancelar}>
              Cancelar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
