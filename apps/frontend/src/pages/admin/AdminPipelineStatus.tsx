import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Activity, CheckCircle2, XCircle, AlertTriangle,
  Loader2, ChevronDown, ExternalLink, Clock,
} from 'lucide-react';
import { usePipelineRuns, usePipelineRunAtivo, type PipelineRun } from '@/hooks/queries/usePipelineRuns';

const STATUS_CONFIG = {
  em_andamento: {
    label: 'Em andamento',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
    icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
  },
  concluido: {
    label: 'Concluído',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  parcial: {
    label: 'Parcial',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
  erro: {
    label: 'Erro',
    badge: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
} as const;

function formatDuracao(s: number | null): string {
  if (s === null) return '—';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r > 0 ? `${m}m ${r}s` : `${m}m`;
}

function ProgressBar({ processadas, total }: { processadas: number | null; total: number | null }) {
  if (!total) return <span className="text-muted-foreground text-xs">—</span>;
  const pct = processadas ? Math.round((processadas / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 bg-muted rounded-full h-1.5 shrink-0">
        <div className="bg-primary h-1.5 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">
        {processadas ?? 0}/{total}
      </span>
    </div>
  );
}

export default function AdminPipelineStatus() {
  const navigate = useNavigate();
  const { data: runAtivo } = usePipelineRunAtivo();
  const { data: runs = [], isLoading } = usePipelineRuns(30);
  const [expandedErro, setExpandedErro] = useState<string | null>(null);

  return (
    <div className="p-4 lg:p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-foreground">Pipeline Drone</h1>
        <p className="text-sm text-muted-foreground">Histórico de execuções do processamento de voos</p>
      </div>

      {/* Banner run ativo */}
      {runAtivo && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 p-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
              Pipeline em andamento
              {runAtivo.levantamento?.titulo ? ` · ${runAtivo.levantamento.titulo}` : ''}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              {runAtivo.imagens_processadas ?? 0}/{runAtivo.total_imagens ?? '?'} imagens
              {' · '}iniciado {formatDistanceToNow(new Date(runAtivo.iniciado_em), { locale: ptBR, addSuffix: true })}
            </p>
          </div>
          <ProgressBar processadas={runAtivo.imagens_processadas} total={runAtivo.total_imagens} />
        </div>
      )}

      {/* Tabela */}
      {isLoading ? (
        <div className="space-y-2">
          {[0,1,2,3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
        </div>
      ) : runs.length === 0 ? (
        <div className="rounded-xl border border-dashed py-14 flex flex-col items-center gap-3 text-center">
          <Activity className="w-8 h-8 text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold">Nenhuma execução registrada</p>
            <p className="text-xs text-muted-foreground">O pipeline Python precisa inserir registros nesta tabela</p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border/60">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Início</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Levantamento</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Imagens</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Itens</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Focos</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Duração</th>
                  <th className="text-center px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">Versão</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {runs.map((run: PipelineRun) => {
                  const cfg = STATUS_CONFIG[run.status];
                  const hasErro = run.status === 'erro' && run.erro_mensagem;
                  return (
                    <>
                      <tr
                        key={run.id}
                        className={`hover:bg-muted/20 transition-colors ${hasErro ? 'bg-red-50/40 dark:bg-red-950/10' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <div className="text-xs font-medium">
                            {new Date(run.iniciado_em).toLocaleDateString('pt-BR')}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {new Date(run.iniciado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {run.levantamento ? (
                            <div>
                              <p className="text-xs font-medium truncate max-w-[160px]">{run.levantamento.titulo}</p>
                              {run.levantamento.data_voo && (
                                <p className="text-[11px] text-muted-foreground">
                                  {new Date(run.levantamento.data_voo).toLocaleDateString('pt-BR')}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.badge}`}>
                            {cfg.icon}
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <ProgressBar processadas={run.imagens_processadas} total={run.total_imagens} />
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-xs">
                          {run.itens_gerados ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-xs">
                          {run.focos_criados ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDuracao(run.duracao_s)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {run.versao_pipeline ?? '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {run.levantamento_id && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-[10px]"
                                onClick={() => navigate(`/levantamentos?id=${run.levantamento_id}`)}
                              >
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            )}
                            {hasErro && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-[10px] text-red-600 hover:text-red-700"
                                onClick={() => setExpandedErro(expandedErro === run.id ? null : run.id)}
                              >
                                <ChevronDown className={`w-3 h-3 transition-transform ${expandedErro === run.id ? 'rotate-180' : ''}`} />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {hasErro && expandedErro === run.id && (
                        <tr key={`${run.id}-erro`} className="bg-red-50/60 dark:bg-red-950/20">
                          <td colSpan={9} className="px-6 py-3">
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                                Erro: {run.erro_mensagem}
                              </p>
                              {run.erro_detalhe && (
                                <Collapsible>
                                  <CollapsibleTrigger className="text-[11px] text-red-600 dark:text-red-400 underline underline-offset-2">
                                    Mostrar detalhes técnicos
                                  </CollapsibleTrigger>
                                  <CollapsibleContent>
                                    <pre className="mt-2 text-[11px] bg-red-100 dark:bg-red-950/40 rounded p-3 overflow-auto max-h-40">
                                      {JSON.stringify(run.erro_detalhe, null, 2)}
                                    </pre>
                                  </CollapsibleContent>
                                </Collapsible>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
