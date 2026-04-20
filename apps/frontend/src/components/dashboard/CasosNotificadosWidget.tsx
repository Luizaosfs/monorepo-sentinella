import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, AlertTriangle, CheckCircle2, Stethoscope, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { useCasosNotificados } from '@/hooks/queries/useCasosNotificados';
import { CasoNotificado, DoencaNotificada } from '@/types/database';
import { STALE } from '@/lib/queryConfig';
import { api } from '@/services/api';

const DOENCA_LABEL: Record<DoencaNotificada, string> = {
  dengue: 'Dengue',
  chikungunya: 'Chikungunya',
  zika: 'Zika',
  suspeito: 'Suspeito',
};

const DOENCA_COLOR: Record<DoencaNotificada, string> = {
  dengue: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30',
  chikungunya: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30',
  zika: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
  suspeito: 'bg-muted/50 text-muted-foreground border-border',
};

function isThisWeek(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return d >= weekAgo;
}

export function CasosNotificadosWidget() {
  const navigate = useNavigate();
  const { clienteId } = useClienteAtivo();
  const { data: casos = [], isLoading } = useCasosNotificados(clienteId);

  // Focos com cruzamento ativo (count via query separada para não impactar perf)
  const { data: focosComCruzamento = 0 } = useQuery({
    queryKey: ['casos_widget', clienteId],
    queryFn: async () => {
      if (!clienteId) return 0;
      try {
        return await api.casosNotificados.cruzamentoCount();
      } catch {
        return 0;
      }
    },
    enabled: !!clienteId,
    staleTime: STALE.SHORT,
  });

  if (isLoading) {
    return (
      <Card className="animate-fade-in card-premium">
        <CardHeader className="p-6 pb-4 border-b border-border/40 bg-muted/20">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
        </CardContent>
      </Card>
    );
  }

  const semana = casos.filter((c) => isThisWeek(c.created_at));
  const confirmados = semana.filter((c) => c.status === 'confirmado');
  const suspeitos = semana.filter((c) => c.status === 'suspeito');

  // Agregar por doença (apenas confirmados + suspeitos desta semana)
  const porDoenca = semana.reduce((acc, c) => {
    if (c.status === 'descartado') return acc;
    acc[c.doenca] = (acc[c.doenca] || 0) + 1;
    return acc;
  }, {} as Record<DoencaNotificada, number>);

  if (semana.length === 0) return null;

  return (
    <Card className="rounded-2xl shadow-sm border-border/60 bg-card overflow-hidden h-full flex flex-col animate-fade-in">
      <CardHeader className="flex flex-row items-center justify-between p-5 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-rose-500/10 flex items-center justify-center">
            <Stethoscope className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-foreground">Casos Notificados</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Últimos 7 dias</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/admin/casos')}
          className="h-8 px-3 rounded-lg border border-border/60 text-[11px] font-bold text-foreground hover:bg-muted/40 transition-colors shadow-sm"
        >
          Ver todos
        </button>
      </CardHeader>

      <CardContent className="p-0 flex-1 flex flex-col">
        {/* Resumo confirmados / suspeitos */}
        <TooltipProvider delayDuration={300}>
          <div className="grid grid-cols-2 divide-x divide-border/40 border-b border-border/40">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center py-4 gap-1 relative cursor-default">
                  <Info className="absolute top-2 right-2 w-3 h-3 text-muted-foreground/40" />
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                    <span className="text-2xl font-black text-rose-600 dark:text-rose-400">{confirmados.length}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Confirmados</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[210px] text-xs leading-relaxed">Casos com diagnóstico <strong>confirmado</strong> nos últimos 7 dias. Acionam cruzamento automático com focos identificados pelo drone em raio de 300m.</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex flex-col items-center py-4 gap-1 relative cursor-default">
                  <Info className="absolute top-2 right-2 w-3 h-3 text-muted-foreground/40" />
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-amber-500" />
                    <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{suspeitos.length}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Suspeitos</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[210px] text-xs leading-relaxed">Casos <strong>aguardando confirmação</strong> laboratorial ou clínica nos últimos 7 dias. Permanecem em suspeito até serem confirmados ou descartados.</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>

        {/* Por doença */}
        <div className="flex flex-wrap gap-2 p-4 border-b border-border/40 bg-muted/20">
          {(Object.entries(porDoenca) as [DoencaNotificada, number][]).map(([doenca, count]) => (
            <Badge
              key={doenca}
              variant="outline"
              className={`${DOENCA_COLOR[doenca]} font-bold text-[10px] px-2.5 py-1 shadow-none`}
            >
              {DOENCA_LABEL[doenca]}: {count}
            </Badge>
          ))}
        </div>

        {/* Focos com cruzamento */}
        {focosComCruzamento > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 bg-rose-500/5 border-b border-rose-500/20">
            <CheckCircle2 className="w-4 h-4 text-rose-500 shrink-0" />
            <p className="text-xs text-foreground/80">
              <strong className="text-rose-600 dark:text-rose-400">{focosComCruzamento}</strong>{' '}
              foco{focosComCruzamento !== 1 ? 's' : ''} com cruzamento ativo — prioridade elevada
            </p>
          </div>
        )}

        {/* Últimos casos */}
        <div className="flex-1 overflow-y-auto">
          {semana.slice(0, 6).map((caso) => (
            <div
              key={caso.id}
              className="flex items-center justify-between px-4 py-3 border-b border-border/40 hover:bg-muted/40 transition-colors cursor-pointer"
              onClick={() => navigate('/admin/casos')}
            >
              <div>
                <p className="text-xs font-semibold text-foreground">
                  {DOENCA_LABEL[caso.doenca]}
                  {caso.bairro && <span className="text-muted-foreground font-normal"> · {caso.bairro}</span>}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {caso.unidade_saude?.nome ?? '—'} ·{' '}
                  {new Date(caso.data_notificacao).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <Badge
                variant="outline"
                className={
                  caso.status === 'confirmado'
                    ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30 text-[9px] font-black uppercase'
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[9px] font-black uppercase'
                }
              >
                {caso.status}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
