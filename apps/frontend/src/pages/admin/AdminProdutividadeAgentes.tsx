import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trophy, Star, Bug, Download, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';
import { AgenteProdutividade } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { getCurrentCiclo as currentCiclo } from '@/lib/ciclo';

const CICLO_LABELS: Record<number, string> = {
  1: 'Ciclo 1 (Jan–Fev)',
  2: 'Ciclo 2 (Mar–Abr)',
  3: 'Ciclo 3 (Mai–Jun)',
  4: 'Ciclo 4 (Jul–Ago)',
  5: 'Ciclo 5 (Set–Out)',
  6: 'Ciclo 6 (Nov–Dez)',
};

function accessRateColor(rate: number): string {
  if (rate >= 80) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
  if (rate >= 60) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
  return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
}

function exportarCsv(rows: AgenteProdutividade[]) {
  const header = ['agente_id', 'agente_nome', 'visitas', 'com_acesso', 'sem_acesso', 'taxa_acesso_pct', 'focos', 'usou_larvicida', 'media_dia'];
  const lines = rows.map(r => [
    r.agente_id,
    `"${r.agente_nome}"`,
    r.visitas,
    r.com_acesso,
    r.sem_acesso,
    r.taxa_acesso_pct,
    r.focos,
    r.usou_larvicida,
    r.media_dia,
  ].join(','));
  const csv = [header.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `produtividade_agentes_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('CSV exportado com sucesso');
}

export default function AdminProdutividadeAgentes() {
  const { clienteId } = useClienteAtivo();
  const [ciclo, setCiclo] = useState(currentCiclo());
  const [selectedAgente, setSelectedAgente] = useState<AgenteProdutividade | null>(null);

  const { data, isLoading } = useQuery<AgenteProdutividade[]>({
    queryKey: ['comparativo_agentes', clienteId, ciclo],
    queryFn: () => api.vistorias.comparativoAgentes(clienteId!, ciclo),
    enabled: !!clienteId,
    staleTime: STALE.MEDIUM,
  });

  const rows = data ?? [];

  // Top performers
  const maisVisitas = rows.length ? [...rows].sort((a, b) => b.visitas - a.visitas)[0] : null;
  const maiorAcesso = rows.length ? [...rows].sort((a, b) => b.taxa_acesso_pct - a.taxa_acesso_pct)[0] : null;
  const maisFocos = rows.length ? [...rows].sort((a, b) => b.focos - a.focos)[0] : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Produtividade de Agentes</h1>
            <p className="text-sm text-muted-foreground">
              Comparativo de desempenho por ciclo
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={String(ciclo)} onValueChange={v => setCiclo(Number(v))}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Selecionar ciclo" />
            </SelectTrigger>
            <SelectContent>
              {([1, 2, 3, 4, 5, 6] as const).map(c => (
                <SelectItem key={c} value={String(c)}>
                  {CICLO_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={!rows.length}
            onClick={() => exportarCsv(rows)}
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Top 3 ranking cards */}
      {isLoading ? (
        <div className="flex gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="flex-1 h-28 rounded-xl" />)}
        </div>
      ) : rows.length > 0 ? (
        <TooltipProvider delayDuration={300}>
        <div className="flex gap-4 flex-wrap">
          {maisVisitas && (
            <Tooltip>
              <TooltipTrigger asChild>
            <Card className="flex-1 min-w-0 relative cursor-default">
              <Info className="absolute top-2 right-2 w-3 h-3 text-muted-foreground/40" />
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-400/20 shrink-0">
                  <Trophy className="h-4 w-4 text-yellow-500" />
                </div>
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
                  Mais Visitas
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xl font-bold truncate">{maisVisitas.agente_nome}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{maisVisitas.visitas} visitas no ciclo</p>
              </CardContent>
            </Card>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[220px] text-xs leading-relaxed">Agente com o maior número total de visitas realizadas no ciclo selecionado, incluindo imóveis com e sem acesso.</TooltipContent>
            </Tooltip>
          )}
          {maiorAcesso && (
            <Tooltip>
              <TooltipTrigger asChild>
            <Card className="flex-1 min-w-0 relative cursor-default">
              <Info className="absolute top-2 right-2 w-3 h-3 text-muted-foreground/40" />
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/20 shrink-0">
                  <Star className="h-4 w-4 text-emerald-500" />
                </div>
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
                  Maior Taxa de Acesso
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xl font-bold truncate">{maiorAcesso.agente_nome}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{maiorAcesso.taxa_acesso_pct}% de acesso</p>
              </CardContent>
            </Card>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[220px] text-xs leading-relaxed">Agente com a maior proporção de visitas em que conseguiu efetivamente entrar no imóvel. Taxa = acessos / total de visitas.</TooltipContent>
            </Tooltip>
          )}
          {maisFocos && (
            <Tooltip>
              <TooltipTrigger asChild>
            <Card className="flex-1 min-w-0 relative cursor-default">
              <Info className="absolute top-2 right-2 w-3 h-3 text-muted-foreground/40" />
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-400/20 shrink-0">
                  <Bug className="h-4 w-4 text-red-500" />
                </div>
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
                  Mais Focos Encontrados
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xl font-bold truncate">{maisFocos.agente_nome}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{maisFocos.focos} focos identificados</p>
              </CardContent>
            </Card>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[220px] text-xs leading-relaxed">Agente que registrou o maior número de depósitos com larvas ou pupas de Aedes aegypti confirmados no ciclo.</TooltipContent>
            </Tooltip>
          )}
        </div>
        </TooltipProvider>
      ) : null}

      {/* Comparative table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">
              Nenhum dado de produtividade para este ciclo.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Agente</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Visitas</th>
                  <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Com Acesso</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Sem Acesso</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Focos</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Larvicida</th>
                  <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Média/dia</th>
                  <th className="px-4 py-3 text-center font-semibold text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={row.agente_id}
                    className={cn(
                      'border-b last:border-0 hover:bg-muted/20 transition-colors',
                      idx % 2 !== 0 && 'bg-muted/5'
                    )}
                  >
                    <td className="px-4 py-3 font-medium">{row.agente_nome}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.visitas}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', accessRateColor(row.taxa_acesso_pct))}>
                        {row.taxa_acesso_pct}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{row.sem_acesso}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.focos > 0 ? (
                        <span className="text-red-600 dark:text-red-400 font-semibold">{row.focos}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{row.usou_larvicida}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.media_dia?.toFixed(1) ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedAgente(row)}
                      >
                        Ver detalhes
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Detail sheet */}
      <Sheet open={!!selectedAgente} onOpenChange={open => { if (!open) setSelectedAgente(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          {selectedAgente && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedAgente.agente_nome}</SheetTitle>
                <p className="text-sm text-muted-foreground">{CICLO_LABELS[ciclo]}</p>
              </SheetHeader>
              <div className="mt-6 space-y-3">
                {[
                  { label: 'Total de visitas', value: selectedAgente.visitas },
                  { label: 'Visitas com acesso', value: selectedAgente.com_acesso },
                  { label: 'Visitas sem acesso', value: selectedAgente.sem_acesso },
                  { label: 'Taxa de acesso', value: `${selectedAgente.taxa_acesso_pct}%` },
                  { label: 'Focos encontrados', value: selectedAgente.focos },
                  { label: 'Usou larvicida', value: selectedAgente.usou_larvicida },
                  { label: 'Média de visitas/dia', value: selectedAgente.media_dia?.toFixed(1) ?? '—' },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <span className="text-sm font-semibold tabular-nums">{String(item.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
