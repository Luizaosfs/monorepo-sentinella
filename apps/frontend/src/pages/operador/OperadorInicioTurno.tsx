import { useNavigate } from 'react-router-dom';
import { Droplets, Search, BarChart3, MapPin, WifiOff, ClipboardList, Info, Target, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { http } from '@sentinella/api-client';
import { STALE } from '@/lib/queryConfig';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { useAuth } from '@/hooks/useAuth';
import { useVistoriaResumo } from '@/hooks/queries/useVistorias';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { useAlertasRetorno } from '@/hooks/queries/useAlertasRetorno';
import { SyncStatusPanel } from '@/components/offline/SyncStatusPanel';
import { getCurrentCiclo } from '@/lib/ciclo';

const ATIVIDADES = [
  {
    key: 'tratamento',
    label: 'Tratamento',
    icon: Droplets,
    className: 'bg-blue-500 hover:bg-blue-600 text-white',
  },
  {
    key: 'pesquisa',
    label: 'Pesquisa',
    icon: Search,
    className: 'bg-green-500 hover:bg-green-600 text-white',
  },
  {
    key: 'liraa',
    label: 'LIRAa',
    icon: BarChart3,
    className: 'bg-orange-500 hover:bg-orange-600 text-white',
  },
  {
    key: 'ponto_estrategico',
    label: 'Ponto Estratégico',
    icon: MapPin,
    className: 'bg-purple-500 hover:bg-purple-600 text-white',
  },
] as const;

const META_DIARIA = 15;

export default function OperadorInicioTurno() {
  const currentCiclo = getCurrentCiclo();
  const navigate = useNavigate();
  const { clienteId } = useClienteAtivo();
  const { usuario } = useAuth();
  const { pendingCount } = useOfflineQueue();
  const { data: alertasRetorno = [] } = useAlertasRetorno(clienteId, usuario?.id ?? null);
  const alertasVencidos = alertasRetorno.filter((a) => new Date(a.retorno_em) <= new Date());

  const { data: resumo, isLoading } = useVistoriaResumo(
    clienteId,
    usuario?.id,
    currentCiclo,
  );

  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const nomeAgente = usuario?.nome ?? 'Agente';
  const hora = new Date().getHours();
  const saudacao =
    hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

  const cobertura = resumo?.cobertura_pct ?? 0;

  // Visitas realizadas hoje
  const { data: visitasHoje = 0 } = useQuery<number>({
    queryKey: ['visitas_hoje', clienteId, usuario?.id],
    queryFn: async () => {
      if (!clienteId || !usuario?.id) return 0;
      const hoje = new Date().toISOString().split('T')[0];
      const res = await http.get<{ count: number }>(
        `/vistorias/count?clienteId=${clienteId}&agenteId=${usuario.id}&createdAfter=${hoje}&acessoRealizado=true`
      );
      return (res as { count?: number }).count ?? 0;
    },
    enabled: !!clienteId && !!usuario?.id,
    staleTime: STALE.SHORT,
    refetchInterval: 60_000,
  });

  const diasRestantesCiclo = (() => {
    const now = new Date();
    const mesAtual = now.getMonth(); // 0-indexed
    // Cada ciclo abrange 2 meses. Fim do ciclo = fim do segundo mês do par
    const mesFimCiclo = mesAtual % 2 === 0 ? mesAtual + 1 : mesAtual;
    const fimCiclo = new Date(now.getFullYear(), mesFimCiclo + 1, 0); // último dia do mês
    const diff = Math.ceil((fimCiclo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  })();

  return (
    <div className="flex flex-col min-h-screen bg-background p-4 gap-4 max-w-lg mx-auto">
      {/* Greeting header */}
      <div className="pt-2">
        <h1 className="text-2xl font-bold tracking-tight">
          {saudacao}, {nomeAgente}!
        </h1>
        <p className="text-muted-foreground text-sm capitalize">{hoje}</p>
      </div>

      {/* Operações offline pendentes de sincronização */}
      <SyncStatusPanel />

      {/* Alerta de retorno vencido */}
      {alertasVencidos.length > 0 && (
        <button
          type="button"
          onClick={() => navigate('/agente/rota?filtro=retorno')}
          className="flex items-center gap-2 rounded-xl border border-orange-300 bg-orange-50 px-4 py-3 text-orange-800 dark:bg-orange-950 dark:border-orange-700 dark:text-orange-200 w-full text-left"
        >
          <Clock className="w-4 h-4 shrink-0" />
          <span className="text-sm font-medium flex-1">
            {alertasVencidos.length} imóvel(is) com retorno pendente — toque para ver no mapa
          </span>
          <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
            {alertasVencidos.length > 9 ? '9+' : alertasVencidos.length}
          </span>
        </button>
      )}

      {/* Offline pending banner */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-800 dark:bg-amber-950 dark:border-amber-700 dark:text-amber-200">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span className="text-sm font-medium">
            {pendingCount} vistoria(s) pendentes de envio — sem conexão
          </span>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {isLoading ? (
          <>
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </>
        ) : (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Card className="rounded-xl relative cursor-default">
                  <Info className="absolute top-1.5 right-1.5 w-3 h-3 text-muted-foreground/40" />
                  <CardContent className="flex flex-col items-center justify-center p-3 gap-1">
                    <span className="text-2xl font-bold text-red-500">
                      {resumo?.pendentes ?? 0}
                    </span>
                    <span className="text-xs text-muted-foreground text-center leading-tight">
                      Pendentes
                    </span>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px] text-xs leading-relaxed">Imóveis que ainda não foram visitados por você neste ciclo. Priorize os de maior risco.</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Card className="rounded-xl relative cursor-default">
                  <Info className="absolute top-1.5 right-1.5 w-3 h-3 text-muted-foreground/40" />
                  <CardContent className="flex flex-col items-center justify-center p-3 gap-1">
                    <span className="text-2xl font-bold text-green-500">
                      {resumo?.visitados ?? 0}
                    </span>
                    <span className="text-xs text-muted-foreground text-center leading-tight">
                      Visitados
                    </span>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px] text-xs leading-relaxed">Imóveis com vistoria concluída (acesso realizado) por você neste ciclo.</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Card className="rounded-xl relative cursor-default">
                  <Info className="absolute top-1.5 right-1.5 w-3 h-3 text-muted-foreground/40" />
                  <CardContent className="flex flex-col items-center justify-center p-3 gap-1">
                    <span className="text-2xl font-bold text-primary">
                      {cobertura}%
                    </span>
                    <span className="text-xs text-muted-foreground text-center leading-tight">
                      Cobertura
                    </span>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden mt-1">
                      <div
                        className="h-2 rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${cobertura}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[200px] text-xs leading-relaxed">Percentual de imóveis visitados em relação ao total da sua carteira neste ciclo.</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Meta diária */}
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Card className="rounded-xl relative">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold">Meta diária</span>
                  </div>
                  <span className={`text-sm font-bold ${visitasHoje >= META_DIARIA ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
                    {visitasHoje} / {META_DIARIA}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${visitasHoje >= META_DIARIA ? 'bg-emerald-500' : 'bg-primary'}`}
                    style={{ width: `${Math.min(100, (visitasHoje / META_DIARIA) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {visitasHoje >= META_DIARIA
                    ? 'Meta atingida! Excelente trabalho.'
                    : `${META_DIARIA - visitasHoje} visita(s) restantes hoje · ${diasRestantesCiclo} dia(s) no ciclo`}
                </p>
                <Info className="absolute top-3 right-3 w-3 h-3 text-muted-foreground/40" />
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[240px] text-xs leading-relaxed">
            Meta diária de <strong>{META_DIARIA}</strong> vistorias (com acesso realizado). Use o progresso para ajustar seu plano do ciclo e priorizar visitas pendentes.
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Activity type section */}
      <div>
        <h2 className="text-base font-semibold mb-3">Tipo de Atividade</h2>
        <TooltipProvider delayDuration={300}>
          <div className="grid grid-cols-2 gap-3">
            {ATIVIDADES.map(({ key, label, icon: Icon, className }) => {
              const tooltip =
                key === 'tratamento'
                  ? 'Tratamento: eliminar focos em depósitos com larvas/pupas e registrar larvicida quando aplicável.'
                  : key === 'pesquisa'
                    ? 'Pesquisa: inspecionar depósitos e identificar focos para orientar o plano de ação.'
                    : key === 'liraa'
                      ? 'LIRAa: foco em indicadores e registros para análise epidemiológica do ciclo.'
                      : 'Ponto Estratégico: visitas em locais de maior risco e relevância para controle vetorial.';

              return (
                <Tooltip key={key}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => navigate(`/agente/imoveis?atividade=${key}`)}
                      className={`relative flex flex-col items-center justify-center gap-2 min-h-24 rounded-2xl font-bold text-sm transition-opacity active:opacity-80 ${className}`}
                    >
                      <Icon className="w-8 h-8" />
                      <span>{label}</span>
                      <Info className="absolute top-2 right-2 w-3 h-3 text-white/70" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[260px] text-xs leading-relaxed">
                    {tooltip}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
      </div>

      {/* Secondary action */}
      <Button
        variant="outline"
        className="w-full rounded-xl h-12 gap-2 mt-1"
        onClick={() => navigate('/agente/imoveis')}
      >
        <ClipboardList className="w-5 h-5" />
        Ver todos os imóveis
      </Button>
    </div>
  );
}
