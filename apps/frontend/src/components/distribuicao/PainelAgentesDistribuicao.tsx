import { Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { AgenteSimples } from '@/hooks/queries/useAgentes';

interface Props {
  agentes: AgenteSimples[];
  cargaAgente: Record<string, { quarteiroes: number; imoveis: number }>;
  totalQuadras: number;
  agentColorMap: Record<string, string>;
}

export function PainelAgentesDistribuicao({ agentes, cargaAgente, totalQuadras, agentColorMap }: Props) {
  const maxImoveis = Math.max(...agentes.map((a) => cargaAgente[a.id]?.imoveis ?? 0), 1);

  return (
    <div className="flex flex-col h-full border rounded-xl bg-card overflow-hidden">
      <div className="px-3 pt-3 pb-2 border-b flex-shrink-0">
        <p className="text-xs font-semibold flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          Agentes ({agentes.length})
        </p>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-border/40">
        {agentes.length === 0 ? (
          <p className="text-xs text-muted-foreground p-4 text-center">
            Nenhum agente cadastrado.
          </p>
        ) : (
          agentes.map((a) => {
            const carga = cargaAgente[a.id] ?? { quarteiroes: 0, imoveis: 0 };
            const pctQ = totalQuadras > 0 ? Math.round((carga.quarteiroes / totalQuadras) * 100) : 0;
            const color = agentColorMap[a.id] ?? '#94a3b8';

            return (
              <div
                key={a.id}
                className="px-3 py-2.5 space-y-1.5 border-l-4"
                style={{ borderLeftColor: color }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs font-medium truncate leading-tight">{a.nome}</span>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Badge variant="outline" className="text-[9px] h-4 px-1">
                      {carga.quarteiroes}Q
                    </Badge>
                    <Badge variant="outline" className="text-[9px] h-4 px-1">
                      {carga.imoveis}I
                    </Badge>
                  </div>
                </div>
                <div className="space-y-0.5">
                  <Progress value={(carga.imoveis / maxImoveis) * 100} className="h-1.5" />
                  <p className="text-[9px] text-muted-foreground">{pctQ}% das quadras</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
