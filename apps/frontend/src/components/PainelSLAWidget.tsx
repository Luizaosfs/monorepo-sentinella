import { useNavigate } from 'react-router-dom';
import { Badge }       from '@/components/ui/badge';
import { Progress }    from '@/components/ui/progress';
import { Skeleton }    from '@/components/ui/skeleton';
import { cn }          from '@/lib/utils';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { usePainelSLA, SLASeveridade, FocoSLAStatus } from '@/hooks/usePainelSLA';

// ─────────────────────────────────────────────────────────────────────────────
// AUX-3 — PainelSLAWidget
// Lista compacta de focos em atenção/crítico/vencido com barra de progresso.
// ─────────────────────────────────────────────────────────────────────────────

const SEV_COLOR: Record<SLASeveridade, string> = {
  vencido: 'bg-red-600 text-white',
  critico: 'bg-orange-500 text-white',
  atencao: 'bg-yellow-400 text-black',
  ok:      'bg-emerald-500 text-white',
};

const PROGRESS_COLOR: Record<SLASeveridade, string> = {
  vencido: '[&>div]:bg-red-600',
  critico: '[&>div]:bg-orange-500',
  atencao: '[&>div]:bg-yellow-400',
  ok:      '[&>div]:bg-emerald-500',
};

function TempoLabel({ min }: { min: number }) {
  if (min <= 0)  return <span className="text-red-500 text-xs font-semibold">Vencido</span>;
  if (min < 60)  return <span className="text-xs text-muted-foreground">{min}min restante</span>;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return <span className="text-xs text-muted-foreground">{h}h{m > 0 ? `${m}m` : ''} restante</span>;
}

function FocoSLARow({ item }: { item: FocoSLAStatus }) {
  const navigate = useNavigate();
  const { foco, pct_consumido, severidade, tempo_restante_min } = item;

  const label = foco.endereco_normalizado
    ?? foco.logradouro
    ?? `Foco ${foco.id.slice(0, 8)}`;

  return (
    <button
      onClick={() => navigate(`/gestor/focos/${foco.id}`)}
      className="w-full text-left px-3 py-2.5 rounded-lg border border-border hover:bg-accent transition-colors"
    >
      <div className="flex items-center justify-between mb-1 gap-2">
        <span className="text-sm font-medium truncate flex-1">{label}</span>
        <Badge className={cn('text-[10px] shrink-0', SEV_COLOR[severidade])}>
          {severidade.toUpperCase()}
        </Badge>
      </div>
      <Progress
        value={Math.min(pct_consumido, 100)}
        className={cn('h-1.5 mb-1', PROGRESS_COLOR[severidade])}
      />
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">
          {foco.prioridade} · {foco.status}
        </span>
        <TempoLabel min={tempo_restante_min} />
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function PainelSLAWidget() {
  const { clienteId } = useClienteAtivo();
  const { alertas, counts, isLoading } = usePainelSLA({ clienteId });

  const total = (counts.vencido ?? 0) + (counts.critico ?? 0) + (counts.atencao ?? 0);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">SLA em Risco</h3>
        <div className="flex gap-1">
          {(counts.vencido ?? 0) > 0 && (
            <Badge className={cn('text-[10px]', SEV_COLOR.vencido)}>
              {counts.vencido} vencido{counts.vencido! > 1 ? 's' : ''}
            </Badge>
          )}
          {(counts.critico ?? 0) > 0 && (
            <Badge className={cn('text-[10px]', SEV_COLOR.critico)}>
              {counts.critico} crítico{counts.critico! > 1 ? 's' : ''}
            </Badge>
          )}
          {(counts.atencao ?? 0) > 0 && (
            <Badge className={cn('text-[10px]', SEV_COLOR.atencao)}>
              {counts.atencao} atenção
            </Badge>
          )}
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : total === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum SLA em risco no momento
        </p>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
          {alertas.map(item => (
            <FocoSLARow key={item.foco.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
