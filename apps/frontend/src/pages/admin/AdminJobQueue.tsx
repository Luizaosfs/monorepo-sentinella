import { useState } from 'react';
import { ListTodo, RefreshCw, RotateCcw, XCircle, Clock, CheckCircle2, AlertTriangle, Loader2, Play } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AdminPageHeader from '@/components/AdminPageHeader';
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
import { useToast } from '@/hooks/use-toast';
import { useJobQueue, useRetryJobMutation, useCancelJobMutation } from '@/hooks/queries/useJobQueue';
import type { JobQueue, JobStatus, JobTipo } from '@/types/database';

// ── Helpers visuais ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<JobStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pendente:     { label: 'Pendente',     color: 'bg-blue-100 text-blue-800',   icon: <Clock className="h-3.5 w-3.5" /> },
  em_execucao:  { label: 'Executando',   color: 'bg-yellow-100 text-yellow-800', icon: <Loader2 className="h-3.5 w-3.5 animate-spin" /> },
  concluido:    { label: 'Concluído',    color: 'bg-green-100 text-green-800', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  falhou:       { label: 'Falhou',       color: 'bg-red-100 text-red-800',     icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  cancelado:    { label: 'Cancelado',    color: 'bg-gray-100 text-gray-600',   icon: <XCircle className="h-3.5 w-3.5" /> },
};

const TIPO_LABELS: Record<JobTipo, string> = {
  triagem_ia:         'Triagem IA',
  relatorio_semanal:  'Relatório Semanal',
  cnes_sync:          'Sync CNES',
  limpeza_retencao:   'Limpeza / Retenção',
  cloudinary_cleanup: 'Cloudinary Cleanup',
  health_check:       'Health Check',
};

function distancia(iso: string) {
  return formatDistanceToNow(new Date(iso), { locale: ptBR, addSuffix: true });
}

function dataCurta(iso: string | null) {
  if (!iso) return '—';
  return format(new Date(iso), 'dd/MM HH:mm', { locale: ptBR });
}

// ── Linha de job ─────────────────────────────────────────────────────────────

function JobRow({ job, onRetry, onCancel }: {
  job: JobQueue;
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const cfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.pendente;

  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-0">
      <div className="flex items-center gap-1.5 mt-0.5 shrink-0">
        {cfg.icon}
      </div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{TIPO_LABELS[job.tipo as JobTipo] ?? job.tipo}</span>
          <Badge className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
          {job.tentativas > 0 && (
            <span className="text-xs text-muted-foreground">
              tentativa {job.tentativas}/{job.max_tentativas}
            </span>
          )}
        </div>
        {job.erro && (
          <p className="text-xs text-red-600 font-mono truncate max-w-sm" title={job.erro}>
            {job.erro}
          </p>
        )}
        <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
          <span>Criado: {distancia(job.criado_em)}</span>
          {job.iniciado_em && <span>Iniciado: {dataCurta(job.iniciado_em)}</span>}
          {job.concluido_em && <span>Concluído: {dataCurta(job.concluido_em)}</span>}
          {job.status === 'pendente' && new Date(job.executar_em) > new Date() && (
            <span className="text-blue-600">Executa {distancia(job.executar_em)}</span>
          )}
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        {(job.status === 'falhou' || job.status === 'cancelado') && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => onRetry(job.id)}>
            <RotateCcw className="h-3 w-3" />
            Retry
          </Button>
        )}
        {job.status === 'pendente' && (
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => onCancel(job.id)}>
            <XCircle className="h-3 w-3" />
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function AdminJobQueue() {
  const { toast } = useToast();
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');

  const { data: jobs = [], isLoading, refetch, isFetching } = useJobQueue({
    status: filtroStatus !== 'todos' ? filtroStatus : undefined,
    tipo: filtroTipo !== 'todos' ? filtroTipo as JobTipo : undefined,
    limit: 200,
  });

  const retryMutation = useRetryJobMutation();
  const cancelMutation = useCancelJobMutation();

  async function handleRetry(id: string) {
    try {
      await retryMutation.mutateAsync(id);
      toast({ title: 'Job reenfileirado' });
    } catch {
      toast({ title: 'Erro ao reenfileirar', variant: 'destructive' });
    }
  }

  async function handleCancel(id: string) {
    try {
      await cancelMutation.mutateAsync(id);
      toast({ title: 'Job cancelado' });
    } catch {
      toast({ title: 'Erro ao cancelar', variant: 'destructive' });
    }
  }

  // Contadores de status
  const counts = jobs.reduce((acc, j) => {
    acc[j.status] = (acc[j.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const temAtivos = (counts['pendente'] ?? 0) + (counts['em_execucao'] ?? 0) > 0;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Fila de Jobs"
        description="Processos assíncronos: triagem IA, relatórios, sync CNES e manutenção."
        icon={ListTodo}
        actions={
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {(['pendente', 'em_execucao', 'concluido', 'falhou', 'cancelado'] as JobStatus[]).map(s => {
          const cfg = STATUS_CONFIG[s];
          return (
            <Card key={s} className={`cursor-pointer transition-colors ${filtroStatus === s ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setFiltroStatus(filtroStatus === s ? 'todos' : s)}>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground">{cfg.label}</p>
                <p className={`text-xl font-bold mt-0.5 ${s === 'falhou' && (counts[s] ?? 0) > 0 ? 'text-red-600' : s === 'em_execucao' ? 'text-yellow-600' : ''}`}>
                  {counts[s] ?? 0}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {temAtivos && (
        <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 rounded-lg px-4 py-2.5">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          Jobs em andamento — esta tela atualiza automaticamente a cada 10s.
        </div>
      )}

      {/* Tabela */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <CardTitle className="text-base flex-1">Jobs</CardTitle>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                {(Object.entries(TIPO_LABELS) as [JobTipo, string][]).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {(Object.keys(STATUS_CONFIG) as JobStatus[]).map(s => (
                  <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <Play className="h-4 w-4" />
              Nenhum job encontrado para os filtros selecionados.
            </div>
          ) : (
            <div>
              {jobs.map(job => (
                <JobRow key={job.id} job={job} onRetry={handleRetry} onCancel={handleCancel} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
