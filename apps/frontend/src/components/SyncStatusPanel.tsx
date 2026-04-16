/**
 * SyncStatusPanel — painel de status de sincronização offline.
 *
 * Exibe:
 *  - Operações pendentes (aguardando internet)
 *  - Operações em dead-letter (falharam MAX_RETRIES vezes)
 *  - Botão "Tentar novamente" (force drain)
 *
 * Uso: montado em AgenteHoje ou OfflineBanner quando pendingCount > 0.
 */
import { useEffect, useState, useCallback } from 'react';
import { WifiOff, RefreshCw, AlertTriangle, CheckCircle2, Clock, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { listAllWithStatus, drainQueue, remove } from '@/lib/offlineQueue';
import type { QueuedOperation } from '@/lib/offlineQueue';
import { toast } from 'sonner';

type OpWithStatus = QueuedOperation & { expired: boolean; deadLetter: boolean };

const TYPE_LABEL: Record<string, string> = {
  save_vistoria:     'Vistoria',
  checkin:           'Check-in',
  update_atendimento:'Atendimento',
};

function opLabel(op: OpWithStatus): string {
  const base = TYPE_LABEL[op.type] ?? op.type;
  if (op.type === 'save_vistoria') {
    const addr = op.payload.imovelId.slice(0, 8);
    return `${base} — imóvel #${addr}`;
  }
  if (op.type === 'checkin' || op.type === 'update_atendimento') {
    return `${base} — item #${op.itemId.slice(0, 8)}`;
  }
  return base;
}

function opAge(createdAt: number): string {
  const diff = Date.now() - createdAt;
  const min  = Math.floor(diff / 60_000);
  const h    = Math.floor(min / 60);
  const d    = Math.floor(h / 24);
  if (d > 0) return `há ${d}d`;
  if (h > 0) return `há ${h}h`;
  return `há ${min}min`;
}

interface SyncStatusPanelProps {
  /** Callback chamado após drain bem-sucedido (para atualizar contadores externos). */
  onRefresh?: () => void;
  className?: string;
}

export function SyncStatusPanel({ onRefresh, className }: SyncStatusPanelProps) {
  const [ops, setOps] = useState<OpWithStatus[]>([]);
  const [draining, setDraining] = useState(false);

  const load = useCallback(async () => {
    try {
      const all = await listAllWithStatus();
      setOps(all);
    } catch {
      // IndexedDB indisponível
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleDrain = async () => {
    setDraining(true);
    try {
      const { ok, failed, expired } = await drainQueue();
      if (ok > 0)      toast.success(`${ok} operaç${ok === 1 ? 'ão enviada' : 'ões enviadas'} com sucesso.`);
      if (failed > 0)  toast.error(`${failed} operaç${failed === 1 ? 'ão falhou' : 'ões falharam'}.`);
      if (expired > 0) toast.warning(`${expired} operaç${expired === 1 ? 'ão expirada descartada' : 'ões expiradas descartadas'}.`);
      await load();
      onRefresh?.();
    } catch {
      toast.error('Erro ao tentar sincronizar.');
    } finally {
      setDraining(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await remove(id);
      await load();
      onRefresh?.();
    } catch {
      toast.error('Erro ao remover operação da fila.');
    }
  };

  const pending    = ops.filter((o) => !o.expired && !o.deadLetter);
  const deadLetter = ops.filter((o) => o.deadLetter && !o.expired);
  const expired    = ops.filter((o) => o.expired);

  if (ops.length === 0) {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400', className)}>
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        Tudo sincronizado.
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <WifiOff className="w-4 h-4 text-amber-500" />
          {ops.length} operaç{ops.length === 1 ? 'ão' : 'ões'} na fila offline
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs"
          onClick={handleDrain}
          disabled={draining || !navigator.onLine}
        >
          <RefreshCw className={cn('w-3.5 h-3.5', draining && 'animate-spin')} />
          {draining ? 'Enviando...' : 'Tentar agora'}
        </Button>
      </div>

      {/* Pendentes normais */}
      {pending.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Aguardando envio ({pending.length})
          </p>
          {pending.map((op) => (
            <div
              key={op.id}
              className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="truncate">{opLabel(op)}</span>
              </div>
              <span className="text-xs text-muted-foreground ml-2 shrink-0">
                {opAge(op.createdAt)}
                {(op.retryCount ?? 0) > 0 && (
                  <Badge variant="outline" className="ml-1 text-[10px] py-0">
                    {op.retryCount}x
                  </Badge>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Dead-letter: falharam MAX_RETRIES vezes */}
      {deadLetter.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-destructive uppercase tracking-wider">
            Falha permanente — não serão reenviadas ({deadLetter.length})
          </p>
          {deadLetter.map((op) => (
            <div
              key={op.id}
              className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                <span className="truncate text-destructive">{opLabel(op)}</span>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-destructive hover:bg-destructive/10 shrink-0"
                onClick={() => handleRemove(op.id)}
                title="Remover da fila"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Expiradas */}
      {expired.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Expiradas — mais de 7 dias ({expired.length})
          </p>
          {expired.map((op) => (
            <div
              key={op.id}
              className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-sm opacity-60"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate line-through">{opLabel(op)}</span>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 shrink-0"
                onClick={() => handleRemove(op.id)}
                title="Remover da fila"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {!navigator.onLine && (
        <p className="text-xs text-muted-foreground text-center">
          Sem conexão — as operações serão enviadas automaticamente ao reconectar.
        </p>
      )}
    </div>
  );
}
