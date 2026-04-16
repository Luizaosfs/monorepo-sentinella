import { Stethoscope, ChevronDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useCasosProximosAoItem, useCruzamentosDoItem } from '@/hooks/queries/useCasosNotificados';
import type { CasoFocoCruzamento } from '@/types/database';

interface ItemCasosNotificadosProps {
  itemId: string;
}

export function ItemCasosNotificados({ itemId }: ItemCasosNotificadosProps) {
  const [casosExpanded, setCasosExpanded] = useState(false);
  const { data: casosCount = 0 } = useCasosProximosAoItem(itemId);
  const { data: cruzamentos = [] } = useCruzamentosDoItem(casosExpanded ? itemId : null);

  if (casosCount === 0) return null;

  return (
    <Card className="rounded-2xl border-2 border-rose-400/50 bg-rose-50/60 dark:bg-rose-950/20 shadow-none overflow-hidden">
      <CardContent className="px-3 py-2.5 sm:px-4 sm:py-3 space-y-2">
        <button
          type="button"
          className="w-full flex items-start gap-2.5 text-left"
          onClick={() => setCasosExpanded((v) => !v)}
        >
          <div className="h-8 w-8 shrink-0 rounded-xl bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center mt-0.5">
            <Stethoscope className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">
              {casosCount} caso{casosCount !== 1 ? 's' : ''} notificado{casosCount !== 1 ? 's' : ''} em até 300m
            </p>
            <p className="text-[11px] text-rose-700/80 dark:text-rose-400/80 mt-0.5">
              Prioridade elevada automaticamente — toque para detalhes
            </p>
          </div>
          <ChevronDown className={cn('w-4 h-4 text-rose-500 shrink-0 mt-1 transition-transform', casosExpanded && 'rotate-180')} />
        </button>

        {casosExpanded && cruzamentos.length > 0 && (
          <div className="mt-1 space-y-1.5 border-t border-rose-300/40 pt-2">
            {cruzamentos.map((c: CasoFocoCruzamento) => (
              <div key={c.id} className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-foreground capitalize">
                  {c.caso?.doenca ?? '—'}
                </span>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>{c.caso?.data_notificacao ? new Date(c.caso.data_notificacao).toLocaleDateString('pt-BR') : '—'}</span>
                  <span className="font-mono">{Math.round(c.distancia_metros)}m</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
