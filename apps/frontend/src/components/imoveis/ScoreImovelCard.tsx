import { cn } from '@/lib/utils';
import { ShieldCheck, Info } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

const SCORE_BG: Record<string, string> = {
  baixo:     'bg-emerald-100 text-emerald-700',
  medio:     'bg-yellow-100 text-yellow-700',
  alto:      'bg-orange-100 text-orange-700',
  muito_alto:'bg-red-100 text-red-700',
  critico:   'bg-red-200 text-red-900 font-bold',
};

const SCORE_BAR: Record<string, string> = {
  baixo:     'bg-emerald-500',
  medio:     'bg-yellow-500',
  alto:      'bg-orange-500',
  muito_alto:'bg-red-500',
  critico:   'bg-red-700',
};

const SCORE_LABEL: Record<string, string> = {
  baixo:     'Baixo',
  medio:     'Médio',
  alto:      'Alto',
  muito_alto:'Muito alto',
  critico:   'Crítico',
};

interface Props {
  score: number | null;
  classificacao: string | null;
  fatores: Record<string, unknown> | null;
  calculadoEm: string | null;
}

export function ScoreImovelCard({ score, classificacao, fatores, calculadoEm }: Props) {
  if (score == null || classificacao == null) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 p-4 flex flex-col items-center gap-1.5 text-center">
        <ShieldCheck className="w-5 h-5 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Score territorial ainda não calculado</p>
      </div>
    );
  }

  const fatorEntries = fatores ? Object.entries(fatores) : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold tabular-nums">{score}</span>
          <span className="text-xs text-muted-foreground">/100</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className={cn('text-xs font-bold px-2.5 py-0.5 rounded-full', SCORE_BG[classificacao] ?? 'bg-muted text-muted-foreground')}>
            {SCORE_LABEL[classificacao] ?? classificacao}
          </span>

          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Sobre o score territorial"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="text-sm space-y-2">
              {fatorEntries.length > 0 ? (
                <>
                  <p className="text-sm text-foreground">
                    Este score foi calculado com base nos fatores sanitários registrados para este imóvel.
                  </p>
                  <ul className="space-y-1 pt-1 border-t border-border/60">
                    {fatorEntries.map(([key, val]) => (
                      <li key={key} className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                        <span className="text-xs font-semibold tabular-nums">{String(val)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Este score é calculado automaticamente com base nas condições sanitárias registradas para o imóvel. Os fatores detalhados não estão disponíveis neste registro.
                </p>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
        <div
          className={cn('h-2 rounded-full', SCORE_BAR[classificacao] ?? 'bg-muted-foreground')}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>

      {fatorEntries.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5">
          {fatorEntries.map(([key, val]) => (
            <div key={key} className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1 gap-1">
              <span className="text-[11px] text-muted-foreground capitalize truncate">{key.replace(/_/g, ' ')}</span>
              <span className="text-[11px] font-semibold shrink-0">{String(val)}</span>
            </div>
          ))}
        </div>
      )}

      {calculadoEm && (
        <p className="text-[10px] text-muted-foreground text-right">
          Calculado {format(new Date(calculadoEm), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </p>
      )}
    </div>
  );
}
