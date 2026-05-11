import { Users, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgenteSimples } from '@/hooks/queries/useAgentes';

interface Props {
  agentes: AgenteSimples[];
  cargaAgente: Record<string, { quarteiroes: number; imoveis: number }>;
  totalQuadras: number;
  agentColorMap: Record<string, string>;
}

export function PainelAgentesDistribuicao({ agentes, cargaAgente, totalQuadras, agentColorMap }: Props) {
  const maxQuadras = Math.max(...agentes.map((a) => cargaAgente[a.id]?.quarteiroes ?? 0), 1);
  const mediaQuadras = agentes.length > 0 && totalQuadras > 0 ? totalQuadras / agentes.length : 0;
  const totalImoveis = agentes.reduce((s, a) => s + (cargaAgente[a.id]?.imoveis ?? 0), 0);
  const ativos = agentes.filter((a) => (cargaAgente[a.id]?.quarteiroes ?? 0) > 0).length;

  return (
    <div className="flex flex-col h-full border rounded-xl bg-card overflow-hidden">
      {/* Header */}
      <div className="px-3 pt-2.5 pb-2 border-b flex-shrink-0 space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            Agentes
          </p>
          <span className="text-[10px] tabular-nums text-muted-foreground font-medium bg-muted/60 px-1.5 py-0.5 rounded">
            {ativos}/{agentes.length}
          </span>
        </div>
        {agentes.length > 0 && mediaQuadras > 0 && (
          <div className="flex items-center justify-between text-[9px] text-muted-foreground/70">
            <span>Ideal: ~{Math.round(mediaQuadras)} q/agente</span>
            {totalImoveis > 0 && <span>{totalImoveis} imóveis</span>}
          </div>
        )}
      </div>

      {/* Agent list */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/30">
        {agentes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-6 text-center h-full">
            <Users className="h-7 w-7 text-muted-foreground/25" />
            <p className="text-xs text-muted-foreground">Nenhum agente disponível.</p>
          </div>
        ) : (
          agentes.map((a) => {
            const carga = cargaAgente[a.id] ?? { quarteiroes: 0, imoveis: 0 };
            const pctBar   = maxQuadras > 0 ? Math.round((carga.quarteiroes / maxQuadras) * 100) : 0;
            const pctIdeal = mediaQuadras > 0 && maxQuadras > 0 ? Math.round((mediaQuadras / maxQuadras) * 100) : 0;
            const pctQ     = totalQuadras > 0 ? Math.round((carga.quarteiroes / totalQuadras) * 100) : 0;
            const color    = agentColorMap[a.id] ?? '#94a3b8';
            const overloaded  = mediaQuadras > 0 && carga.quarteiroes > mediaQuadras * 1.4;
            const underloaded = mediaQuadras > 0 && carga.quarteiroes > 0 && carga.quarteiroes < mediaQuadras * 0.5;
            const empty = carga.quarteiroes === 0;

            return (
              <div
                key={a.id}
                className="px-3 py-2 border-l-[3px] transition-colors hover:bg-muted/10"
                style={{ borderLeftColor: color }}
              >
                {/* Name row */}
                <div className="flex items-center justify-between gap-1.5 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-xs font-medium truncate leading-none">{a.nome}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {overloaded && <TrendingUp className="h-3 w-3 text-orange-500" />}
                    {underloaded && <TrendingDown className="h-3 w-3 text-sky-400" />}
                    {empty ? (
                      <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full leading-none">
                        vazio
                      </span>
                    ) : (
                      <span className={cn(
                        'text-xs font-bold tabular-nums',
                        overloaded ? 'text-orange-600' : 'text-foreground',
                      )}>
                        {carga.quarteiroes}
                        <span className="text-[10px] font-normal text-muted-foreground ml-0.5">q</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress bar — agent color + ideal marker */}
                <div className="relative h-2 w-full rounded-full bg-muted/50 overflow-hidden mb-1">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pctBar}%`,
                      backgroundColor: color,
                      opacity: empty ? 0.2 : 0.80,
                    }}
                  />
                  {pctIdeal > 2 && pctIdeal < 98 && (
                    <div
                      className="absolute top-0 bottom-0 w-px bg-foreground/25"
                      style={{ left: `${pctIdeal}%` }}
                    />
                  )}
                </div>

                {/* Sub-stats */}
                <div className="flex items-center justify-between text-[9px] text-muted-foreground/70">
                  <span>{pctQ}% das quadras</span>
                  {carga.imoveis > 0 && (
                    <span>
                      {carga.imoveis} im.
                      {totalImoveis > 0 && (
                        <span className="text-muted-foreground/40 ml-0.5">
                          ({Math.round((carga.imoveis / totalImoveis) * 100)}%)
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
