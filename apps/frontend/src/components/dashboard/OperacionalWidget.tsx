import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Map as MapIcon, MoreHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePluvioOperacionalRun } from '@/hooks/queries/usePluvio';

const CLASSIFICACAO_CONFIG: Record<string, { bg: string; text: string }> = {
  Baixo:        { bg: 'bg-emerald-500/15', text: 'text-emerald-600 dark:text-emerald-400' },
  Moderado:     { bg: 'bg-yellow-500/15',  text: 'text-yellow-600 dark:text-yellow-400' },
  Alto:         { bg: 'bg-orange-500/15',   text: 'text-orange-600 dark:text-orange-400' },
  'Muito Alto': { bg: 'bg-red-500/15',     text: 'text-red-600 dark:text-red-400' },
  Crítico:      { bg: 'bg-red-700/15',     text: 'text-red-700 dark:text-red-400' },
};

interface Props {
  clienteId: string | null;
}

export const OperacionalWidget = ({ clienteId }: Props) => {
  const navigate = useNavigate();
  const { data: run, isLoading: loading } = usePluvioOperacionalRun(clienteId);

  if (loading) {
    return (
      <Card className="rounded-2xl shadow-sm border-border/60 bg-card">
        <CardHeader className="p-6 pb-4 border-b border-border/40">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="p-6 space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  if (!run || run.items.length === 0) return null;

  const runDate = new Date(run.dt_ref + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <Card className="rounded-2xl shadow-sm border-border/60 bg-card overflow-hidden flex flex-col animate-fade-in group">
      <CardHeader className="flex flex-row items-center justify-between p-5 border-b border-border/60">
        <div>
          <CardTitle className="text-base font-bold text-foreground">
            Tabela Operacional — {runDate}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Status e plano de ação por bairro</p>
        </div>
        <button
          onClick={() => navigate('/gestor/pluvio-operacional')}
          className="h-8 px-3 rounded-lg border border-border/60 text-[11px] font-bold text-foreground hover:bg-muted/40 transition-colors shadow-sm"
        >
          Ver completa
        </button>
      </CardHeader>

      <CardContent className="p-0">
        <div className="w-full relative overflow-x-auto max-h-[400px]">
          <Table>
            <TableHeader className="bg-muted/30 sticky top-0 z-10 backdrop-blur-sm">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold text-xs tracking-wider uppercase">Bairro</TableHead>
                <TableHead className="font-semibold text-xs tracking-wider uppercase">Status de Risco</TableHead>
                <TableHead className="font-semibold text-xs tracking-wider uppercase text-center">Chuva (mm)</TableHead>
                <TableHead className="font-semibold text-xs tracking-wider uppercase">Prioridade</TableHead>
                <TableHead className="font-semibold text-xs tracking-wider uppercase">SLA</TableHead>
                <TableHead className="font-semibold text-xs tracking-wider uppercase text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {run.items.slice(0, 10).map((item) => {
                const cfg = CLASSIFICACAO_CONFIG[item.classificacao_risco] ?? { bg: 'bg-muted/50', text: 'text-muted-foreground' };
                return (
                  <TableRow key={item.id} className="hover:bg-muted/30 transition-colors group/row">
                    <TableCell className="font-medium text-sm">
                      <span
                        className="cursor-pointer hover:text-primary transition-colors hover:underline decoration-primary/30 underline-offset-4"
                        onClick={() => navigate(`/admin/regioes?search=${encodeURIComponent(item.bairro_nome)}`)}
                      >
                        {item.bairro_nome}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${cfg.bg} ${cfg.text} border-transparent text-[10px] uppercase font-black tracking-widest px-2 py-0.5 shadow-none`}>
                        {item.classificacao_risco}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-mono text-xs font-semibold">
                        {item.chuva_24h_mm != null ? `${item.chuva_24h_mm} mm` : '—'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-xs text-muted-foreground">
                        {item.prioridade_operacional}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">
                        {item.prazo_acao || '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground transition-colors">
                            <span className="sr-only">Abrir menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[160px] rounded-xl shadow-lg border-border/60">
                          <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">Ações do bairro</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => navigate(`/admin/regioes?search=${encodeURIComponent(item.bairro_nome)}`)}
                            className="text-xs font-medium cursor-pointer"
                          >
                            <MapIcon className="mr-2 h-3.5 w-3.5" />
                            Ver no mapa
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => navigate('/agente/hoje')}
                            className="text-xs font-medium cursor-pointer"
                          >
                            <FileText className="mr-2 h-3.5 w-3.5" />
                            Atualizar SLA
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
