import { useState, useMemo } from 'react';
import { Globe2, TrendingUp, AlertTriangle, BarChart3, ArrowUpDown, ArrowUp, ArrowDown, Download, Info } from 'lucide-react';
import { useComparativoMunicipios } from '@/hooks/queries/useComparativoMunicipios';
import { MunicipioStats } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type SortKey = keyof Pick<MunicipioStats, 'nome' | 'total' | 'resolvidos' | 'pendentes' | 'criticos' | 'altos'> | 'taxa_resolucao';
type SortDir = 'asc' | 'desc';

function calcTaxaResolucao(s: MunicipioStats): number {
  if (s.total === 0) return 0;
  return Math.round((s.resolvidos / s.total) * 100);
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />;
  return sortDir === 'asc'
    ? <ArrowUp className="h-3.5 w-3.5 text-primary" />
    : <ArrowDown className="h-3.5 w-3.5 text-primary" />;
}

function RankingCard({
  title,
  subtitle,
  value,
  icon: Icon,
  color,
  tooltip,
}: {
  title: string;
  subtitle: string;
  value: string;
  icon: React.ElementType;
  color: string;
  tooltip?: string;
}) {
  const card = (
    <Card className="flex-1 min-w-0 relative cursor-default">
      {tooltip && <Info className="absolute top-2 right-2 w-3 h-3 text-muted-foreground/40" />}
      <CardHeader className="flex flex-row items-center gap-3 pb-2">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl shrink-0', color)}>
          <Icon className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
            {title}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xl font-bold truncate">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
      </CardContent>
    </Card>
  );
  if (!tooltip) return card;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{card}</TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[220px] text-xs leading-relaxed">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function exportCsv(rows: (MunicipioStats & { taxa_resolucao: number })[]) {
  const header = ['Município', 'Total (7d)', 'Resolvidos', 'Pendentes', 'Em atendimento', 'Críticos', 'Altos', 'Taxa resolução (%)'];
  const lines = rows.map(r => [
    `"${r.nome}"`,
    r.total,
    r.resolvidos,
    r.pendentes,
    r.em_atendimento,
    r.criticos,
    r.altos,
    r.taxa_resolucao,
  ].join(','));
  const csv = [header.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `comparativo_municipios_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminPainelMunicipios() {
  const { data, isLoading, error } = useComparativoMunicipios();
  const [sortKey, setSortKey] = useState<SortKey>('total');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const rows = useMemo(() => {
    if (!data) return [];
    const enriched = data.map(s => ({ ...s, taxa_resolucao: calcTaxaResolucao(s) }));
    return [...enriched].sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortKey === 'taxa_resolucao') {
        av = a.taxa_resolucao;
        bv = b.taxa_resolucao;
      } else if (sortKey === 'nome') {
        av = a.nome.toLowerCase();
        bv = b.nome.toLowerCase();
      } else {
        av = a[sortKey] as number;
        bv = b[sortKey] as number;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortDir]);

  const ranking = useMemo(() => {
    if (!rows.length) return null;
    const melhorTaxa = [...rows].sort((a, b) => b.taxa_resolucao - a.taxa_resolucao)[0];
    const maisCriticos = [...rows].sort((a, b) => b.criticos - a.criticos)[0];
    const maisTotal = [...rows].sort((a, b) => b.total - a.total)[0];
    return { melhorTaxa, maisCriticos, maisTotal };
  }, [rows]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const cols: { key: SortKey; label: string; align?: 'right' }[] = [
    { key: 'nome', label: 'Município' },
    { key: 'total', label: 'Itens/semana', align: 'right' },
    { key: 'resolvidos', label: 'Resolvidos', align: 'right' },
    { key: 'pendentes', label: 'Pendentes', align: 'right' },
    { key: 'criticos', label: 'Críticos', align: 'right' },
    { key: 'taxa_resolucao', label: 'Taxa resolução', align: 'right' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Globe2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Painel Comparativo — Municípios</h1>
            <p className="text-sm text-muted-foreground">Métricas dos últimos 7 dias por cliente ativo</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => rows.length && exportCsv(rows)}
          disabled={!rows.length}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Ranking cards */}
      {isLoading ? (
        <div className="flex gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="flex-1 h-28 rounded-xl" />)}
        </div>
      ) : ranking ? (
        <TooltipProvider delayDuration={300}>
          <div className="flex gap-4 flex-wrap">
            <RankingCard
              title="Melhor taxa de resolução"
              value={`${ranking.melhorTaxa.taxa_resolucao}%`}
              subtitle={ranking.melhorTaxa.nome}
              icon={TrendingUp}
              color="bg-emerald-500"
              tooltip="Município com maior percentual de itens identificados resolvidos dentro do prazo nos últimos 7 dias."
            />
            <RankingCard
              title="Mais focos críticos"
              value={String(ranking.maisCriticos.criticos)}
              subtitle={ranking.maisCriticos.nome}
              icon={AlertTriangle}
              color="bg-red-500"
              tooltip="Município com maior número de focos classificados como Crítico ou Urgente. Requer atenção prioritária."
            />
            <RankingCard
              title="Mais itens identificados"
              value={String(ranking.maisTotal.total)}
              subtitle={ranking.maisTotal.nome}
              icon={BarChart3}
              color="bg-blue-500"
              tooltip="Município com maior volume total de itens identificados (todos os status) nos últimos 7 dias."
            />
          </div>
        </TooltipProvider>
      ) : null}

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {error ? (
            <div className="p-8 text-center text-destructive text-sm">
              Erro ao carregar dados: {(error as Error).message}
            </div>
          ) : isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">
              Nenhum dado encontrado nos últimos 7 dias.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  {cols.map(col => (
                    <th
                      key={col.key}
                      className={cn(
                        'px-4 py-3 font-semibold text-muted-foreground cursor-pointer select-none whitespace-nowrap hover:text-foreground transition-colors',
                        col.align === 'right' ? 'text-right' : 'text-left'
                      )}
                      onClick={() => handleSort(col.key)}
                    >
                      <span className={cn('inline-flex items-center gap-1.5', col.align === 'right' && 'flex-row-reverse')}>
                        {col.label}
                        <SortIcon col={col.key} sortKey={sortKey} sortDir={sortDir} />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr
                    key={row.clienteId}
                    className={cn(
                      'border-b last:border-0 transition-colors hover:bg-muted/20',
                      idx % 2 === 0 ? '' : 'bg-muted/5'
                    )}
                  >
                    <td className="px-4 py-3 font-medium">{row.nome}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{row.total}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">
                      {row.resolvidos}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-amber-600 dark:text-amber-400">
                      {row.pendentes}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.criticos > 0 ? (
                        <Badge variant="destructive" className="ml-auto">
                          {row.criticos}
                        </Badge>
                      ) : (
                        <span className="tabular-nums text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn(
                        'tabular-nums font-semibold',
                        row.taxa_resolucao >= 80
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : row.taxa_resolucao >= 50
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-red-600 dark:text-red-400'
                      )}>
                        {row.taxa_resolucao}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
