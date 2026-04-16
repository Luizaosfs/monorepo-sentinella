import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import { ScoreSurtoRegiao } from '@/types/database';

const CLASS_COLOR: Record<string, string> = {
  crítico: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30',
  alto: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30',
  moderado: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  baixo: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30',
};

export function ScoreSurtoWidget() {
  const { clienteId } = useClienteAtivo();
  const navigate = useNavigate();

  const { data = [], isLoading } = useQuery({
    queryKey: ['score_surto', clienteId],
    queryFn: () => api.scoreSurto.porRegiao(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.MEDIUM,
  });

  const top3 = (data as ScoreSurtoRegiao[]).slice(0, 3);

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2 pt-4 px-4 flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Alerta preditivo — próx. 2 semanas
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 rounded-lg" />)}
          </div>
        ) : top3.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">Sem regiões cadastradas</p>
        ) : (
          top3.map((r) => (
            <div key={r.regiao_id} className="flex items-center justify-between gap-2 rounded-xl border bg-muted/30 px-3 py-2">
              <span className="text-xs font-medium truncate">{r.regiao_nome}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold tabular-nums">{r.score_total}</span>
                <Badge variant="outline" className={`text-[10px] font-bold uppercase ${CLASS_COLOR[r.classificacao] ?? ''}`}>
                  {r.classificacao}
                </Badge>
              </div>
            </div>
          ))
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-8 text-xs gap-1 mt-1"
          onClick={() => navigate('/admin/score-surto')}
        >
          Ver todos os bairros <ArrowRight className="h-3 w-3" />
        </Button>
      </CardContent>
    </Card>
  );
}
