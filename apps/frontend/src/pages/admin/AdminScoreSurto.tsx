import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, Info } from 'lucide-react';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import { ScoreSurtoRegiao } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type Classificacao = 'critico' | 'alto' | 'moderado' | 'baixo';

function getClassificacao(score: number): Classificacao {
  if (score >= 80) return 'critico';
  if (score >= 60) return 'alto';
  if (score >= 30) return 'moderado';
  return 'baixo';
}

function classificacaoBadge(classificacao: Classificacao) {
  const map: Record<Classificacao, { label: string; className: string }> = {
    critico: { label: 'Crítico', className: 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400' },
    alto: { label: 'Alto', className: 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400' },
    moderado: { label: 'Moderado', className: 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400' },
    baixo: { label: 'Baixo', className: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400' },
  };
  return map[classificacao];
}

function scoreProgressColor(score: number): string {
  if (score >= 80) return '[&>div]:bg-red-500';
  if (score >= 60) return '[&>div]:bg-orange-500';
  if (score >= 30) return '[&>div]:bg-yellow-500';
  return '[&>div]:bg-emerald-500';
}

function TooltipCell({ label, value }: { label: string; value: number | string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1 cursor-help tabular-nums">
          {String(value)}
          <Info className="h-3 w-3 text-muted-foreground" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p className="text-xs">{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export default function AdminScoreSurto() {
  const { clienteId } = useClienteAtivo();

  const { data, isLoading } = useQuery<ScoreSurtoRegiao[]>({
    queryKey: ['score_surto', clienteId],
    queryFn: () => api.scoreSurto.porRegiao(clienteId!),
    enabled: !!clienteId,
    staleTime: STALE.MEDIUM,
    refetchInterval: 5 * 60 * 1000,
  });

  const rows = data ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Score de Risco de Surto</h1>
          <p className="text-sm text-muted-foreground">
            Próximas 2 semanas — atualizado com dados pluviométricos
          </p>
        </div>
      </div>

      {/* Methodology note */}
      <Card className="border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20">
        <CardContent className="flex items-start gap-3 py-4">
          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Score calculado com base em:{' '}
            <strong>precipitação (30%)</strong>,{' '}
            <strong>focos recorrentes (30%)</strong>,{' '}
            <strong>casos notificados 14d (25%)</strong>,{' '}
            <strong>SLAs vencidos (15%)</strong>.
          </p>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Score por Região</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">
              Nenhuma região com dados de score disponíveis.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground whitespace-nowrap">Região</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground whitespace-nowrap min-w-[180px]">Score Total</th>
                  <th className="px-4 py-3 text-center font-semibold text-muted-foreground whitespace-nowrap">Classificação</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground whitespace-nowrap">Pluvio</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground whitespace-nowrap">Recorrência</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground whitespace-nowrap">Casos 14d</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground whitespace-nowrap">SLA Vencido</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const classificacao = getClassificacao(row.score_total);
                  const badgeInfo = classificacaoBadge(classificacao);
                  const progressColor = scoreProgressColor(row.score_total);
                  return (
                    <tr
                      key={row.regiao_id ?? idx}
                      className={cn(
                        'border-b last:border-0 hover:bg-muted/20 transition-colors',
                        idx % 2 !== 0 && 'bg-muted/5'
                      )}
                    >
                      <td className="px-4 py-3 font-medium">{row.regiao_nome}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 min-w-[150px]">
                          <span className="tabular-nums font-bold w-8 text-right shrink-0">{row.score_total}</span>
                          <Progress
                            value={row.score_total}
                            className={cn('flex-1 h-2', progressColor)}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn(
                          'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
                          badgeInfo.className
                        )}>
                          {badgeInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <TooltipCell
                          label="Contribuição do risco pluviométrico"
                          value={row.contrib_pluvio ?? '—'}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <TooltipCell
                          label="Contribuição dos focos recorrentes"
                          value={row.contrib_recorrencia ?? '—'}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <TooltipCell
                          label="Contribuição dos casos notificados nos últimos 14 dias"
                          value={row.contrib_casos_14d ?? '—'}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <TooltipCell
                          label="Contribuição dos SLAs vencidos"
                          value={row.contrib_sla_vencido ?? '—'}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
