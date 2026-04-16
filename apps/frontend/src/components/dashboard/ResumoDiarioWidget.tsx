import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, RefreshCw, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import { toast } from 'sonner';

interface ResumoDiario {
  id: string;
  cliente_id: string;
  data_ref: string;
  sumario: string;
  metricas: Record<string, unknown> | null;
  created_at: string;
}

export function ResumoDiarioWidget() {
  const { clienteId } = useClienteAtivo();
  const queryClient = useQueryClient();
  const [histOpen, setHistOpen] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const { data: resumos = [], isLoading } = useQuery<ResumoDiario[]>({
    queryKey: ['resumos_diarios', clienteId],
    queryFn: () => api.resumosDiarios.list(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.SHORT,
  });

  const todayResumo = resumos.find((r) => r.data_ref === today);
  const historico = resumos.slice(0, 30);

  const gerarMutation = useMutation({
    mutationFn: () => api.resumosDiarios.gerar(clienteId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resumos_diarios', clienteId] });
      toast.success('Resumo diário gerado');
    },
    onError: () => toast.error('Erro ao gerar resumo'),
  });

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2 pt-4 px-4 flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          Resumo de hoje
        </CardTitle>
        <Dialog open={histOpen} onOpenChange={setHistOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
              <Clock className="h-3 w-3" /> Histórico
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Resumos diários</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              {historico.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum resumo gerado ainda</p>
              ) : historico.map((r) => (
                <div key={r.id} className="border rounded-xl p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px]">
                      {new Date(r.data_ref).toLocaleDateString('pt-BR')}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{r.sumario}</p>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        ) : todayResumo ? (
          <p className="text-xs text-muted-foreground leading-relaxed">{todayResumo.sumario}</p>
        ) : (
          <div className="text-center py-3 space-y-3">
            <p className="text-xs text-muted-foreground">Resumo de hoje ainda não foi gerado</p>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-2 rounded-xl"
              onClick={() => gerarMutation.mutate()}
              disabled={gerarMutation.isPending}
            >
              <RefreshCw className={`h-3 w-3 ${gerarMutation.isPending ? 'animate-spin' : ''}`} />
              {gerarMutation.isPending ? 'Gerando...' : 'Gerar agora'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
