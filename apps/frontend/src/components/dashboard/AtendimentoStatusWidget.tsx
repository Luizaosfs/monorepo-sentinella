import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Circle, CircleDot, CheckCircle2, TrendingUp, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AtendimentoStatusCounts, LevantamentoItem } from '@/types/database';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  /** Contagens globais (RPC); evita o limite de 1000 linhas do select em lote. */
  counts: AtendimentoStatusCounts | undefined;
  /** Últimos resolvidos (query enxuta). */
  recentes: LevantamentoItem[];
  isLoading?: boolean;
}

export function AtendimentoStatusWidget({ counts, recentes, isLoading }: Props) {
  const stats = useMemo(() => {
    const total = counts?.total ?? 0;
    const pendente = counts?.pendente ?? 0;
    const em_atendimento = counts?.em_atendimento ?? 0;
    const resolvido = counts?.resolvido ?? 0;
    const taxaResolucao = total > 0 ? Math.round((resolvido / total) * 100) : 0;
    return { pendente, em_atendimento, resolvido, total, taxaResolucao };
  }, [counts]);

  if (!isLoading && counts && counts.total === 0) return null;

  const bars = [
    { key: 'pendente',       label: 'Pendentes',      count: stats.pendente,       color: 'bg-muted-foreground/40', textColor: 'text-muted-foreground', icon: <Circle className="w-3.5 h-3.5" />, tooltip: 'Itens identificados ainda sem agente atribuído ou ação iniciada. Devem ser priorizados pela equipe.' },
    { key: 'em_atendimento', label: 'Em atendimento', count: stats.em_atendimento, color: 'bg-blue-500',            textColor: 'text-blue-600',         icon: <CircleDot className="w-3.5 h-3.5" />, tooltip: 'Itens com agente de campo atribuído e ação em andamento. Aguardando conclusão.' },
    { key: 'resolvido',      label: 'Resolvidos',     count: stats.resolvido,      color: 'bg-emerald-500',         textColor: 'text-emerald-600',       icon: <CheckCircle2 className="w-3.5 h-3.5" />, tooltip: 'Itens com plano de ação concluído e data de resolução registrada.' },
  ] as const;

  return (
    <Card className="rounded-2xl shadow-sm border-border/60 bg-card overflow-hidden animate-fade-in">
      <CardHeader className="flex flex-row items-center justify-between px-5 pt-5 pb-3 border-b border-border/60">
        <div>
          <CardTitle className="text-base font-bold text-foreground">Atendimentos</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Status dos itens identificados</p>
          <p className="text-[10px] text-muted-foreground/90 mt-1 leading-snug">
            Visão geral de todos os itens do cliente (contagem no servidor, sem limite de páginas). No app do agente, &quot;Meus itens&quot; mostra só os direcionados a você.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
          <TrendingUp className="w-4 h-4" />
          {isLoading ? '—' : `${stats.taxaResolucao}% resolvido`}
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-4">
        {/* Barra de progresso geral */}
        <div className="space-y-1.5">
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted/50">
            {stats.total > 0 && !isLoading && (
              <>
                <div
                  className="h-full bg-emerald-500 transition-all duration-700"
                  style={{ width: `${(stats.resolvido / stats.total) * 100}%` }}
                />
                <div
                  className="h-full bg-blue-500 transition-all duration-700"
                  style={{ width: `${(stats.em_atendimento / stats.total) * 100}%` }}
                />
              </>
            )}
            {isLoading && <div className="h-full w-full animate-pulse bg-muted/80" />}
          </div>
          <p className="text-[10px] text-muted-foreground">
            {isLoading ? 'Carregando totais…' : `${stats.total} itens no total`}
          </p>
        </div>

        {/* Cards por status */}
        <TooltipProvider delayDuration={300}>
          <div className="grid grid-cols-3 gap-2">
            {bars.map(({ key, label, count, color, textColor, icon, tooltip }) => (
              <Tooltip key={key}>
                <TooltipTrigger asChild>
                  <div className="flex flex-col gap-1.5 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 relative cursor-default">
                    <Info className="absolute top-1.5 right-1.5 w-2.5 h-2.5 text-muted-foreground/40" />
                    <span className={cn('flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide', textColor)}>
                      {icon}{label}
                    </span>
                    <span className={cn('text-2xl font-black text-foreground leading-none', isLoading && 'animate-pulse text-muted-foreground')}>
                      {isLoading ? '—' : count}
                    </span>
                    <div className="h-1 w-full rounded-full bg-muted/60 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700', color)}
                        style={{ width: !isLoading && stats.total > 0 ? `${(count / stats.total) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[210px] text-xs leading-relaxed">{tooltip}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>

        {/* Resoluções recentes */}
        {!isLoading && recentes.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resolvidos recentemente</p>
            <div className="divide-y divide-border/40 rounded-xl border border-border/60 overflow-hidden">
              {recentes.map((item) => (
                <div key={item.id} className="flex items-center justify-between px-3 py-2 bg-muted/10">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground truncate">{item.item || '—'}</p>
                    {item.endereco_curto && (
                      <p className="text-[10px] text-muted-foreground truncate">{item.endereco_curto}</p>
                    )}
                  </div>
                  <div className="shrink-0 ml-3 text-right">
                    <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold">
                      <CheckCircle2 className="w-3 h-3" />
                      {item.data_resolucao
                        ? new Date(item.data_resolucao).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
                        : '—'}
                    </span>
                    {item.acao_aplicada && (
                      <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">{item.acao_aplicada}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
