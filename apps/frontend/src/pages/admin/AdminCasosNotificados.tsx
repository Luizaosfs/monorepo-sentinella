import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Stethoscope, AlertTriangle, CheckCircle2, Activity,
  Search, Filter, PlusCircle, ChevronDown, ChevronRight,
  MapPin, CalendarDays, Pencil, Info, ChevronLeft, Download,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { useCasosNotificadosPaginados, useUpdateStatusCasoMutation, useUpdateCasoMutation } from '@/hooks/queries/useCasosNotificados';
import { CasoNotificado, DoencaNotificada, StatusCaso } from '@/types/database';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const DOENCA_LABEL: Record<DoencaNotificada, string> = {
  dengue: 'Dengue',
  chikungunya: 'Chikungunya',
  zika: 'Zika',
  suspeito: 'Suspeito',
};

const STATUS_LABEL: Record<StatusCaso, string> = {
  suspeito: 'Suspeito',
  confirmado: 'Confirmado',
  descartado: 'Descartado',
};

const DOENCA_COLOR: Record<DoencaNotificada, string> = {
  dengue: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30',
  chikungunya: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30',
  zika: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
  suspeito: 'bg-muted/60 text-muted-foreground border-border',
};

const STATUS_COLOR: Record<StatusCaso, string> = {
  suspeito: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  confirmado: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30',
  descartado: 'bg-muted/40 text-muted-foreground border-border',
};

const PERIODOS = [
  { label: '7 dias', days: 7 },
  { label: '30 dias', days: 30 },
  { label: '90 dias', days: 90 },
];

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function groupByBairro(casos: CasoNotificado[]): Map<string, CasoNotificado[]> {
  const m = new Map<string, CasoNotificado[]>();
  for (const c of casos) {
    const key = c.bairro || 'Sem bairro';
    if (!m.has(key)) m.set(key, []);
    m.get(key)!.push(c);
  }
  return m;
}

interface EditForm {
  doenca: string;
  logradouro_bairro: string;
  bairro: string;
  observacao: string;
}

export default function AdminCasosNotificados() {
  const navigate = useNavigate();
  const { clienteId } = useClienteAtivo();
  const {
    allCasos: casos,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useCasosNotificadosPaginados(clienteId);
  const updateStatus = useUpdateStatusCasoMutation();
  const updateCaso = useUpdateCasoMutation();

  const [busca, setBusca] = useState('');
  const [filtroDoenca, setFiltroDoenca] = useState<string>('todos');
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroBairro, setFiltroBairro] = useState<string>('todos');
  const [filtroPeriodoDias, setFiltroPeriodoDias] = useState(30);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [editandoCaso, setEditandoCaso] = useState<CasoNotificado | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ doenca: '', logradouro_bairro: '', bairro: '', observacao: '' });
  // D-06: rastreia bairros para os quais já foi solicitado planejamento nesta sessão
  const [planejamentosJaSolicitados, setPlanejamentosJaSolicitados] = useState<Set<string>>(new Set());

  // QW-17: paginação client-side dos resultados filtrados
  const PAGE_SIZE = 25;
  const [pagina, setPagina] = useState(1);

  const resetPagina = useCallback(() => {
    setPagina(1);
  }, []);

  function handleCriarPlanejamentoBairro(bairro: string) {
    if (planejamentosJaSolicitados.has(bairro)) {
      toast.warning(`Planejamento para "${bairro}" já foi solicitado nesta sessão. Verifique em Planejamentos antes de criar outro.`);
      navigate('/admin/planejamentos');
      return;
    }
    setPlanejamentosJaSolicitados((prev) => new Set(prev).add(bairro));
    navigate('/admin/planejamentos', { state: { bairroDestaque: bairro, fromCluster: true } });
  }

  // Bairros únicos para o filtro dropdown
  const bairrosUnicos = useMemo(() =>
    Array.from(new Set(casos.map((c) => c.bairro).filter(Boolean))).sort() as string[],
  [casos]);

  useEffect(() => {
    setPagina(1);
  }, [filtroDoenca, filtroStatus, filtroBairro, filtroPeriodoDias, busca]);

  const filtrados = useMemo(() => {
    const corte = daysAgo(filtroPeriodoDias);
    return casos.filter((c) => {
      if (new Date(c.created_at) < corte) return false;
      if (filtroDoenca !== 'todos' && c.doenca !== filtroDoenca) return false;
      if (filtroStatus !== 'todos' && c.status !== filtroStatus) return false;
      if (filtroBairro !== 'todos' && c.bairro !== filtroBairro) return false;
      if (busca) {
        const q = busca.toLowerCase();
        if (
          !c.bairro?.toLowerCase().includes(q) &&
          !c.logradouro_bairro?.toLowerCase().includes(q) &&
          !(c.unidade_saude?.nome?.toLowerCase().includes(q) ?? false)
        ) return false;
      }
      return true;
    });
  }, [casos, filtroDoenca, filtroStatus, filtroBairro, filtroPeriodoDias, busca]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const casosNaPagina = filtrados.slice((paginaAtual - 1) * PAGE_SIZE, paginaAtual * PAGE_SIZE);

  function exportarCSV() {
    const header = ['Data notificação', 'Doença', 'Status', 'Bairro', 'Logradouro', 'Unidade de saúde', 'Início sintomas', 'Observação'];
    const rows = filtrados.map((c) => [
      c.data_notificacao ?? c.created_at?.slice(0, 10) ?? '',
      DOENCA_LABEL[c.doenca] ?? c.doenca,
      STATUS_LABEL[c.status] ?? c.status,
      c.bairro ?? '',
      c.logradouro_bairro ?? '',
      (c as CasoNotificado & { unidade_saude?: { nome: string } }).unidade_saude?.nome ?? '',
      c.data_inicio_sintomas ?? '',
      (c.observacao ?? '').replace(/\n/g, ' '),
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `casos_notificados_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function abrirEdicao(caso: CasoNotificado, e: React.MouseEvent) {
    e.stopPropagation();
    setEditandoCaso(caso);
    setEditForm({
      doenca: caso.doenca,
      logradouro_bairro: caso.logradouro_bairro ?? '',
      bairro: caso.bairro ?? '',
      observacao: caso.observacao ?? '',
    });
  }

  async function handleSalvarEdicao() {
    if (!editandoCaso) return;
    try {
      await updateCaso.mutateAsync({
        id: editandoCaso.id,
        payload: {
          doenca: editForm.doenca as DoencaNotificada,
          logradouro_bairro: editForm.logradouro_bairro || null,
          bairro: editForm.bairro || null,
          observacao: editForm.observacao || null,
        },
      });
      toast.success('Caso atualizado.');
      setEditandoCaso(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar caso');
    }
  }

  // Clusters por bairro com 3+ casos (suspeitos + confirmados)
  const clustersBairro = useMemo(() => {
    const ativos = filtrados.filter((c) => c.status !== 'descartado');
    const por = groupByBairro(ativos);
    return Array.from(por.entries())
      .filter(([, arr]) => arr.length >= 3)
      .sort((a, b) => b[1].length - a[1].length);
  }, [filtrados]);

  const totalSuspeitos = filtrados.filter((c) => c.status === 'suspeito').length;
  const totalConfirmados = filtrados.filter((c) => c.status === 'confirmado').length;
  const totalDescartados = filtrados.filter((c) => c.status === 'descartado').length;

  const handleUpdateStatus = async (id: string, status: StatusCaso) => {
    try {
      await updateStatus.mutateAsync({ id, status });
      toast.success(`Caso marcado como ${status}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar status');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10">
            <Stethoscope className="h-5 w-5 text-rose-600 dark:text-rose-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Casos Notificados</h1>
            <p className="text-sm text-muted-foreground">Central de vigilância epidemiológica</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-2 rounded-xl"
            onClick={exportarCSV}
            disabled={filtrados.length === 0}
            title="Exportar casos filtrados como CSV"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </Button>
          <Button
            size="sm"
            className="gap-2 rounded-xl"
            onClick={() => navigate('/notificador/registrar')}
          >
            <PlusCircle className="w-4 h-4" />
            Registrar caso
          </Button>
        </div>
      </div>

      {/* Cards resumo */}
      <TooltipProvider delayDuration={300}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="rounded-2xl border-border relative cursor-default">
                <Info className="absolute top-2 right-2 w-3.5 h-3.5 text-muted-foreground/40" />
                <CardContent className="p-4 flex items-center gap-3">
                  <Activity className="w-8 h-8 text-amber-500 shrink-0" />
                  <div>
                    <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{totalSuspeitos}</p>
                    <p className="text-xs text-muted-foreground">Suspeitos</p>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[230px] text-xs leading-relaxed">
              Casos registrados <strong>aguardando confirmação</strong> laboratorial ou clínica. Permanecem neste status até serem confirmados ou descartados.
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="rounded-2xl border-border relative cursor-default">
                <Info className="absolute top-2 right-2 w-3.5 h-3.5 text-muted-foreground/40" />
                <CardContent className="p-4 flex items-center gap-3">
                  <AlertTriangle className="w-8 h-8 text-rose-500 shrink-0" />
                  <div>
                    <p className="text-2xl font-black text-rose-600 dark:text-rose-400">{totalConfirmados}</p>
                    <p className="text-xs text-muted-foreground">Confirmados</p>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[240px] text-xs leading-relaxed">
              Casos com <strong>diagnóstico confirmado</strong> por exame laboratorial ou critério clínico-epidemiológico. Acionam o cruzamento automático com focos de drone em raio de 300m.
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="rounded-2xl border-border relative cursor-default">
                <Info className="absolute top-2 right-2 w-3.5 h-3.5 text-muted-foreground/40" />
                <CardContent className="p-4 flex items-center gap-3">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{totalDescartados}</p>
                    <p className="text-xs text-muted-foreground">Descartados</p>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[230px] text-xs leading-relaxed">
              Casos <strong>avaliados e descartados</strong> após investigação. Não contam nos alertas de cluster nem nos cruzamentos com focos identificados pelo drone.
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="rounded-2xl border-border relative cursor-default">
                <Info className="absolute top-2 right-2 w-3.5 h-3.5 text-muted-foreground/40" />
                <CardContent className="p-4 flex items-center gap-3">
                  <MapPin className="w-8 h-8 text-primary shrink-0" />
                  <div>
                    <p className="text-2xl font-black text-foreground">{filtrados.length}</p>
                    <p className="text-xs text-muted-foreground">No período</p>
                  </div>
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[230px] text-xs leading-relaxed">
              <strong>Total de casos</strong> (todos os status) registrados dentro do período selecionado pelo filtro de datas. Reflete os filtros de doença, status e bairro aplicados.
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      {/* Alerta de clusters por bairro */}
      {clustersBairro.length > 0 && (
        <Card className="rounded-2xl border-rose-400/40 bg-rose-50/50 dark:bg-rose-950/10">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Clusters de atenção — {clustersBairro.length} bairro{clustersBairro.length > 1 ? 's' : ''} com 3+ casos ativos
            </p>
            <div className="flex flex-wrap gap-2">
              {clustersBairro.map(([bairro, arr]) => (
                <div key={bairro} className="flex items-center gap-2 bg-rose-100/60 dark:bg-rose-900/30 border border-rose-300/40 rounded-lg px-3 py-1.5">
                  <span className="text-xs font-semibold text-foreground">{bairro}</span>
                  <Badge variant="outline" className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30 text-[9px] font-black">
                    {arr.length} casos
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    className={`h-6 px-2 text-[10px] gap-1 ${planejamentosJaSolicitados.has(bairro) ? 'text-muted-foreground' : 'text-rose-700 hover:bg-rose-200/50'}`}
                    onClick={() => handleCriarPlanejamentoBairro(bairro)}
                    title={planejamentosJaSolicitados.has(bairro) ? 'Planejamento já solicitado para este bairro' : undefined}
                  >
                    <PlusCircle className="w-3 h-3" />
                    {planejamentosJaSolicitados.has(bairro) ? 'Ver planejamentos' : 'Planejamento'}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtros */}
      <Card className="rounded-2xl border-border">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Bairro, endereço ou unidade..."
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  resetPagina();
                }}
                className="pl-9 rounded-xl"
              />
            </div>
            <Select
              value={filtroDoenca}
              onValueChange={(v) => {
                setFiltroDoenca(v);
                resetPagina();
              }}
            >
              <SelectTrigger className="w-40 rounded-xl">
                <SelectValue placeholder="Doença" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as doenças</SelectItem>
                <SelectItem value="dengue">Dengue</SelectItem>
                <SelectItem value="chikungunya">Chikungunya</SelectItem>
                <SelectItem value="zika">Zika</SelectItem>
                <SelectItem value="suspeito">Suspeito</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filtroStatus}
              onValueChange={(v) => {
                setFiltroStatus(v);
                resetPagina();
              }}
            >
              <SelectTrigger className="w-36 rounded-xl">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="suspeito">Suspeito</SelectItem>
                <SelectItem value="confirmado">Confirmado</SelectItem>
                <SelectItem value="descartado">Descartado</SelectItem>
              </SelectContent>
            </Select>
            {bairrosUnicos.length > 0 && (
              <Select
                value={filtroBairro}
                onValueChange={(v) => {
                  setFiltroBairro(v);
                  resetPagina();
                }}
              >
                <SelectTrigger className="w-40 rounded-xl">
                  <SelectValue placeholder="Bairro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os bairros</SelectItem>
                  {bairrosUnicos.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex items-center gap-1 border border-border rounded-xl overflow-hidden">
              {PERIODOS.map(({ label, days }) => (
                <button
                  key={days}
                  onClick={() => {
                    setFiltroPeriodoDias(days);
                    resetPagina();
                  }}
                  className={cn(
                    'px-3 h-9 text-xs font-semibold transition-colors',
                    filtroPeriodoDias === days
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted/50 text-muted-foreground'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card className="rounded-2xl border-border overflow-hidden">
        <CardHeader className="px-5 py-4 border-b border-border/60 bg-muted/20">
          <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <Filter className="w-4 h-4" />
            {filtrados.length} caso{filtrados.length !== 1 ? 's' : ''} encontrado{filtrados.length !== 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
          </div>
        ) : filtrados.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">
            Nenhum caso encontrado para os filtros selecionados.
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {casosNaPagina.map((caso) => (
              <div key={caso.id}>
                {/* Row principal */}
                <div
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => setExpandido(expandido === caso.id ? null : caso.id)}
                >
                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2 min-w-0">
                    {/* Data */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                      {new Date(caso.data_notificacao).toLocaleDateString('pt-BR')}
                    </div>
                    {/* Doença */}
                    <Badge variant="outline" className={cn(DOENCA_COLOR[caso.doenca], 'text-[10px] font-bold w-fit')}>
                      {DOENCA_LABEL[caso.doenca]}
                    </Badge>
                    {/* Bairro */}
                    <span className="text-xs text-foreground truncate">
                      {caso.bairro || <span className="text-muted-foreground italic">sem bairro</span>}
                    </span>
                    {/* Unidade */}
                    <span className="text-xs text-muted-foreground truncate hidden sm:block">
                      {caso.unidade_saude?.nome ?? '—'}
                    </span>
                  </div>

                  <Badge variant="outline" className={cn(STATUS_COLOR[caso.status], 'text-[9px] font-black uppercase shrink-0')}>
                    {caso.status}
                  </Badge>
                  {expandido === caso.id
                    ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                </div>

                {/* Expansão */}
                {expandido === caso.id && (
                  <div className="px-5 pb-4 bg-muted/20 border-t border-border/30 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 text-xs">
                      {caso.data_inicio_sintomas && (
                        <div>
                          <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Início sintomas</p>
                          <p className="font-semibold">{new Date(caso.data_inicio_sintomas).toLocaleDateString('pt-BR')}</p>
                        </div>
                      )}
                      {caso.logradouro_bairro && (
                        <div>
                          <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Endereço</p>
                          <p className="font-semibold">{caso.logradouro_bairro}</p>
                        </div>
                      )}
                      {caso.latitude != null && (
                        <div>
                          <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Coordenadas</p>
                          <p className="font-mono text-[11px]">{caso.latitude.toFixed(5)}, {caso.longitude?.toFixed(5)}</p>
                        </div>
                      )}
                      {caso.observacao && (
                        <div className="col-span-2 sm:col-span-3">
                          <p className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Observação</p>
                          <p className="font-semibold">{caso.observacao}</p>
                        </div>
                      )}
                    </div>

                    {/* Ações */}
                    <div className="flex gap-2 flex-wrap">
                      {caso.status !== 'descartado' && caso.status === 'suspeito' && (
                        <Button
                          size="sm"
                          className="h-7 px-3 text-xs gap-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white"
                          onClick={() => handleUpdateStatus(caso.id, 'confirmado')}
                          disabled={updateStatus.isPending}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Confirmar
                        </Button>
                      )}
                      {caso.status !== 'descartado' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-3 text-xs gap-1 rounded-lg"
                          onClick={() => handleUpdateStatus(caso.id, 'descartado')}
                          disabled={updateStatus.isPending}
                        >
                          Descartar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-3 text-xs gap-1 rounded-lg"
                        onClick={(e) => abrirEdicao(caso, e)}
                      >
                        <Pencil className="w-3 h-3" />
                        Editar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Carregar mais (cursor pagination — QW-17C) */}
        {hasNextPage && (
          <div className="flex justify-center px-5 py-3 border-t border-border/40">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl gap-2"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? 'Carregando...' : `Carregar mais casos`}
            </Button>
          </div>
        )}

        {/* Paginação client-side sobre os registros já carregados */}
        {filtrados.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border/40 bg-muted/10">
            <span className="text-xs text-muted-foreground">
              {((paginaAtual - 1) * PAGE_SIZE) + 1}–{Math.min(paginaAtual * PAGE_SIZE, filtrados.length)} de {filtrados.length}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={paginaAtual <= 1}
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPaginas || Math.abs(p - paginaAtual) <= 1)
                .reduce<(number | '...')[]>((acc, p, i, arr) => {
                  if (i > 0 && typeof arr[i - 1] === 'number' && (p as number) - (arr[i - 1] as number) > 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === '...'
                    ? <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
                    : (
                      <Button
                        key={p}
                        variant={paginaAtual === p ? 'default' : 'ghost'}
                        size="sm"
                        className="h-7 w-7 p-0 text-xs"
                        onClick={() => setPagina(p as number)}
                      >
                        {p}
                      </Button>
                    )
                )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={paginaAtual >= totalPaginas}
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Dialog de edição */}
      <Dialog open={!!editandoCaso} onOpenChange={(open) => { if (!open) setEditandoCaso(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar caso notificado</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Doença</Label>
              <Select value={editForm.doenca} onValueChange={(v) => setEditForm((f) => ({ ...f, doenca: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="suspeito">Suspeito (a confirmar)</SelectItem>
                  <SelectItem value="dengue">Dengue</SelectItem>
                  <SelectItem value="chikungunya">Chikungunya</SelectItem>
                  <SelectItem value="zika">Zika</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Endereço (sem dados pessoais — LGPD)</Label>
              <Input
                value={editForm.logradouro_bairro}
                onChange={(e) => setEditForm((f) => ({ ...f, logradouro_bairro: e.target.value }))}
                placeholder="Ex: Rua das Flores, 100"
              />
            </div>
            <div className="grid gap-2">
              <Label>Bairro</Label>
              <Input
                value={editForm.bairro}
                onChange={(e) => setEditForm((f) => ({ ...f, bairro: e.target.value }))}
                placeholder="Nome do bairro"
              />
            </div>
            <div className="grid gap-2">
              <Label>Observação</Label>
              <Textarea
                value={editForm.observacao}
                onChange={(e) => setEditForm((f) => ({ ...f, observacao: e.target.value }))}
                placeholder="Informações adicionais..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditandoCaso(null)}>Cancelar</Button>
            <Button onClick={handleSalvarEdicao} disabled={updateCaso.isPending}>
              {updateCaso.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
