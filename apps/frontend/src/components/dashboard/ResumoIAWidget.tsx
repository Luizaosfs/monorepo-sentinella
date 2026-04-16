import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, RefreshCw, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import { logEvento } from '@/lib/pilotoEventos';
import { toast } from 'sonner';
import type { IaInsight } from '@/types/database';

export function ResumoIAWidget() {
  const { clienteId } = useClienteAtivo();
  const queryClient = useQueryClient();

  const { data: insight, isLoading } = useQuery<IaInsight | null>({
    queryKey: ['ia_insights_resumo', clienteId],
    queryFn: async () => {
      const result = await api.iaInsights.getResumo(clienteId!);
      if (result) logEvento('resumo_visualizado', clienteId);
      return result;
    },
    enabled: !!clienteId,
    staleTime: STALE.SHORT,
  });

  const gerarMutation = useMutation({
    mutationFn: (force: boolean) => {
      logEvento(force ? 'resumo_refresh_manual' : 'resumo_gerado', clienteId);
      return api.iaInsights.gerar(clienteId!, force);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ia_insights_resumo', clienteId] });
      queryClient.invalidateQueries({ queryKey: ['resumos_diarios', clienteId] });
      toast.success('Resumo IA gerado');
    },
    onError: () => toast.error('Erro ao gerar resumo'),
  });

  const horaGerado = insight
    ? new Date(insight.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <Card className="rounded-2xl border-border/60">
      <CardHeader className="pb-2 pt-4 px-4 flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
          Resumo executivo
          <Badge className="text-[10px] px-1.5 py-0 h-4 bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border-0">
            IA
          </Badge>
        </CardTitle>
        {horaGerado && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0">
            <Clock className="h-3 w-3" />
            {horaGerado}
          </span>
        )}
      </CardHeader>

      <CardContent className="px-4 pb-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-3 w-full rounded" />
            <Skeleton className="h-3 w-5/6 rounded" />
            <Skeleton className="h-3 w-4/5 rounded" />
          </div>
        ) : insight ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
              {insight.texto}
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground px-2"
              onClick={() => gerarMutation.mutate(true)}
              disabled={gerarMutation.isPending}
            >
              <RefreshCw className={`h-3 w-3 ${gerarMutation.isPending ? 'animate-spin' : ''}`} />
              {gerarMutation.isPending ? 'Gerando...' : 'Gerar novo'}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4">
            <p className="text-xs text-muted-foreground text-center">
              Nenhum resumo gerado hoje. Gere agora para receber uma análise do dia.
            </p>
            <Button
              size="sm"
              className="gap-1.5 text-xs h-8"
              onClick={() => gerarMutation.mutate(false)}
              disabled={gerarMutation.isPending}
            >
              <Sparkles className="h-3 w-3" />
              {gerarMutation.isPending ? 'Gerando...' : 'Gerar resumo'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
