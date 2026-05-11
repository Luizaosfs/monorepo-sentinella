import { Users } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
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

  return (
    <div className="flex flex-col h-full border rounded-xl bg-card overflow-hidden">
      <div className="px-3 pt-3 pb-2 border-b flex-shrink-0">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            Agentes
          </p>
          <span className="text-[10px] text-muted-foreground font-medium bg-muted/60 px-1.5 py-0.5 rounded tabular-nums">
            {agentes.length}
          </span>
        </div>
        {agentes.length > 0 && mediaQuadras > 0 && (
          <p className="text-[10px] text-muted-foreground mt-1.5 leading-tight">
            Ideal: ~{Math.round(mediaQuadras)} quadras/agente
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-border/40">
        {agentes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
            <Users className="h-7 w-7 text-muted-foreground/25" />
            <p className="text-xs text-muted-foreground">Nenhum agente disponível.</p>
          </div>
        ) : (
          agentes.map((a) => {
            const carga = cargaAgente[a.id] ?? { quarteiroes: 0, imoveis: 0 };
            const pctBar = Math.round((carga.quarteiroes / maxQuadras) * 100);
            const pctQ = totalQuadras > 0 ? Math.round((carga.quarteiroes / totalQuadras) * 100) : 0;
            const color = agentColorMap[a.id] ?? '#94a3b8';
            const overloaded = mediaQuadras > 0 && carga.quarteiroes > mediaQuadras * 1.4;
            const empty = carga.quarteiroes === 0;

            return (
              <div
                key={a.id}
                className="px-3 py-2.5 space-y-1.5 border-l-[3px]"
                style={{ borderLeftColor: color }}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-xs font-medium truncate leading-tight">{a.nome}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {overloaded && (
                      <span className="text-[9px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-1 py-0.5 rounded leading-none">
                        ↑
                      </span>
                    )}
                    {empty && (
                      <span className="text-[9px] text-muted-foreground bg-muted px-1 py-0.5 rounded leading-none">
                        vazio
                      </span>
                    )}
                    <span className={cn(
                      'text-xs font-bold tabular-nums',
                      overloaded ? 'text-orange-600' : empty ? 'text-muted-foreground' : 'text-foreground',
                    )}>
                      {carga.quarteiroes}
                    </span>
                    <span className="text-[10px] text-muted-foreground">q</span>
                  </div>
                </div>
                <div className="space-y-0.5">
                  <Progress value={pctBar} className="h-1.5" />
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-muted-foreground">{pctQ}% das quadras</span>
                    <span className="text-[9px] text-muted-foreground">
                      {carga.imoveis} im.
                      {totalImoveis > 0 && carga.imoveis > 0 && (
                        <span className="text-muted-foreground/60 ml-0.5">
                          ({Math.round((carga.imoveis / totalImoveis) * 100)}%)
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
