import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Droplets, CloudRain, PlusCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PluvioRisco } from '@/types/database';
import { Skeleton } from '@/components/ui/skeleton';
import { usePluvioRiscoByCliente } from '@/hooks/queries/usePluvio';

const CLASSIFICACAO_CONFIG: Record<string, { bg: string; text: string; border: string }> = {
  Baixo:        { bg: 'bg-emerald-500/15', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30' },
  Moderado:     { bg: 'bg-yellow-500/15',  text: 'text-yellow-600 dark:text-yellow-400',   border: 'border-yellow-500/30' },
  Alto:         { bg: 'bg-orange-500/15',   text: 'text-orange-600 dark:text-orange-400',   border: 'border-orange-500/30' },
  'Muito Alto': { bg: 'bg-red-500/15',     text: 'text-red-600 dark:text-red-400',         border: 'border-red-500/30' },
  Critico:      { bg: 'bg-red-700/15',     text: 'text-red-700 dark:text-red-400',         border: 'border-red-700/30' },
  'Crítico':    { bg: 'bg-red-700/15',     text: 'text-red-700 dark:text-red-400',         border: 'border-red-700/30' },
};

const DEFAULT_CONFIG = { bg: 'bg-muted/50', text: 'text-muted-foreground', border: 'border-border' };

interface PluvioRiskWidgetProps {
  clienteId: string | null;
}

export const PluvioRiskWidget = ({ clienteId }: PluvioRiskWidgetProps) => {
  const navigate = useNavigate();
  const { data = [], isLoading: loading } = usePluvioRiscoByCliente(clienteId);

  // Sort: highest severity first
  const sorted = [...data].sort((a, b) => {
    const severityOrder: Record<string, number> = { 'Crítico': 5, 'Critico': 5, 'Muito Alto': 4, 'Alto': 3, 'Moderado': 2, 'Baixo': 1 };
    const sa = severityOrder[a.risco?.classificacao_final ?? ''] ?? 0;
    const sb = severityOrder[b.risco?.classificacao_final ?? ''] ?? 0;
    return sb - sa;
  });

  if (loading) {
    return (
      <Card className="animate-fade-in card-premium">
        <CardHeader className="p-6 pb-4 border-b border-border/40 bg-muted/20">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </CardContent>
      </Card>
    );
  }

  if (sorted.length === 0) return null;

  // Regiões em janela crítica pós-chuva: 3–6 dias após chuva intensa (larvas em desenvolvimento ativo)
  const janelaCritica = sorted.filter((r) => {
    const dp = (r.risco as PluvioRisco | undefined)?.dias_pos_chuva;
    return dp != null && dp >= 3 && dp <= 6;
  });

  const summary = sorted.reduce((acc, r) => {
    const key = r.risco?.classificacao_final ?? 'Sem dados';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Card className="rounded-2xl shadow-sm border-border/60 bg-card overflow-hidden h-full flex flex-col animate-fade-in group">
      <CardHeader className="flex flex-row items-center justify-between p-5 border-b border-border/60">
        <div>
          <CardTitle className="text-base font-bold text-foreground">Risco Pluviométrico</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Status pluviométrico por região</p>
        </div>
        <button
          onClick={() => navigate('/admin/pluvio-risco')}
          className="h-8 px-3 rounded-lg border border-border/60 text-[11px] font-bold text-foreground hover:bg-muted/40 transition-colors shadow-sm"
        >
          Ver todos
        </button>
      </CardHeader>

      <CardContent className="p-0 flex-1 flex flex-col">
        {/* Alerta de janela pós-chuva — janela crítica 3-6 dias após chuva intensa */}
        {janelaCritica.length > 0 && (
          <div className="flex items-start gap-3 px-4 py-3 bg-amber-500/10 border-b border-amber-500/25">
            <div className="h-8 w-8 shrink-0 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center mt-0.5">
              <CloudRain className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                Janela crítica para focos de dengue
              </p>
              <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                {janelaCritica.length} região{janelaCritica.length > 1 ? 'ões' : ''} entre 3–6 dias após chuva intensa — larvas em desenvolvimento ativo.
              </p>
            </div>
            <Button
              size="sm"
              className="shrink-0 h-7 px-2.5 text-[11px] gap-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white border-0"
              onClick={() => navigate('/admin/planejamentos')}
            >
              <PlusCircle className="w-3 h-3" />
              Criar planejamento
            </Button>
          </div>
        )}

        <div className="flex flex-wrap gap-2 p-4 border-b border-border/40 bg-muted/20">
          {Object.entries(summary).map(([key, count]) => {
            const cfg = CLASSIFICACAO_CONFIG[key] ?? DEFAULT_CONFIG;
            return (
              <Badge key={key} variant="outline" className={`${cfg.bg} ${cfg.text} ${cfg.border} font-bold text-[10px] px-2.5 py-1 transition-transform cursor-pointer hover:-translate-y-0.5 shadow-none`}>
                {key}: {count}
              </Badge>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto">
          {sorted.slice(0, 8).map((r) => {
            const risco = r.risco as PluvioRisco | undefined;
            const classificacao = risco?.classificacao_final ?? 'Sem dados';
            const cfg = CLASSIFICACAO_CONFIG[classificacao] ?? DEFAULT_CONFIG;

            return (
              <div
                key={r.id}
                className="flex items-center justify-between p-4 border-b border-border/40 hover:bg-muted/60 transition-colors cursor-pointer"
                onClick={() => navigate(`/admin/regioes?search=${encodeURIComponent(r.regiao)}`)}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0 border ${cfg.border}`}>
                    <Droplets className={`w-5 h-5 ${cfg.text}`} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground hover:text-primary transition-colors">
                      {r.regiao}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={`${cfg.bg} ${cfg.text} ${cfg.border} text-[9px] px-1.5 py-0 uppercase font-black tracking-widest`}>
                        {classificacao}
                      </Badge>
                      {risco && (
                        <span className="text-xs text-muted-foreground font-mono">
                          Risco: {risco.prob_final_min ?? '?'}–{risco.prob_final_max ?? '?'}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {risco && (
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-black text-foreground">{risco.chuva_24h ?? 0}mm</span>
                    <span className="text-[10px] text-muted-foreground font-semibold mt-0.5">/ 24h</span>
                  </div>
                )}
              </div>
            );
          })}

          {sorted.length > 8 && (
            <div className="p-4 text-center">
              <span className="text-xs text-muted-foreground opacity-80">
                +{sorted.length - 8} regiões adicionais não exibidas.
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
