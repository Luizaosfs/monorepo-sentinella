import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Home,
  Loader2,
  Map,
  RefreshCw,
  Users,
  XCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  useCoberturaAgentes,
  useCoberturaQuarteiroes,
  useImoveisNuncaVisitados,
  useResumoCoberturaOperacional,
} from '@/hooks/queries/useCoberturaOperacional';
import type { StatusCobertura } from '@/services/api/domains/cobertura-operacional';

function statusBadge(status: StatusCobertura) {
  if (status === 'coberto') return <Badge className="bg-green-100 text-green-800">Coberto</Badge>;
  if (status === 'parcial') return <Badge className="bg-yellow-100 text-yellow-800">Parcial</Badge>;
  return <Badge className="bg-red-100 text-red-800">Sem cobertura</Badge>;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  loading,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
            {loading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <p className="text-2xl font-bold leading-tight">{value}</p>
            )}
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function GestorCoberturaOperacional() {
  const { data: resumo, isLoading: loadingResumo } = useResumoCoberturaOperacional();
  const { data: quarteiroes, isLoading: loadingQ } = useCoberturaQuarteiroes();
  const { data: agentes, isLoading: loadingA } = useCoberturaAgentes();
  const { data: nuncaVisitados, isLoading: loadingN } = useImoveisNuncaVisitados();

  const cicloNome = resumo?.ciclo?.nome ?? 'Sem ciclo ativo';
  const pct = resumo?.municipio.percentual_cobertura ?? 0;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Cobertura Territorial</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {loadingResumo ? <Skeleton className="h-4 w-40 inline-block" /> : cicloNome}
          </p>
        </div>
        {!resumo?.ciclo && !loadingResumo && (
          <Badge variant="outline" className="text-yellow-700 border-yellow-400 bg-yellow-50 gap-1">
            <AlertTriangle className="w-3 h-3" />
            Nenhum ciclo ativo
          </Badge>
        )}
      </div>

      {/* KPIs do município */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={Building2}
          label="Total de imóveis"
          value={resumo?.municipio.total_imoveis ?? '—'}
          loading={loadingResumo}
        />
        <KpiCard
          icon={CheckCircle2}
          label="Visitados no ciclo"
          value={resumo?.municipio.total_visitados ?? '—'}
          loading={loadingResumo}
        />
        <KpiCard
          icon={XCircle}
          label="Pendentes"
          value={resumo?.municipio.total_pendentes ?? '—'}
          loading={loadingResumo}
        />
        <KpiCard
          icon={Activity}
          label="Cobertura geral"
          value={`${pct}%`}
          loading={loadingResumo}
        />
      </div>

      {/* Barra de progresso geral */}
      {!loadingResumo && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progresso do ciclo</span>
              <span className="text-sm text-muted-foreground">{pct}%</span>
            </div>
            <Progress value={pct} className="h-3" />
          </CardContent>
        </Card>
      )}

      {/* Cards de quarteirões e agentes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Map className="w-4 h-4 text-primary" />
              Quarteirões
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {loadingResumo ? (
              <Skeleton className="h-20" />
            ) : (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-medium">{resumo?.quarteiroes.total ?? 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-green-700">Cobertos</span>
                  <span className="font-medium">{resumo?.quarteiroes.cobertos ?? 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-yellow-700">Parciais</span>
                  <span className="font-medium">{resumo?.quarteiroes.parcialmente_cobertos ?? 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-red-700">Sem cobertura</span>
                  <span className="font-medium">{resumo?.quarteiroes.sem_cobertura ?? 0}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Agentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {loadingResumo ? (
              <Skeleton className="h-20" />
            ) : (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-medium">{resumo?.agentes.total ?? 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-green-700">Com vistorias</span>
                  <span className="font-medium">{resumo?.agentes.com_cobertura ?? 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-red-700">Sem vistorias</span>
                  <span className="font-medium">{resumo?.agentes.sem_cobertura ?? 0}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              Indicadores de risco
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {loadingResumo ? (
              <Skeleton className="h-20" />
            ) : (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Imóveis nunca visitados</span>
                  <span className={cn('font-medium', (resumo?.indicadores.imoveis_nunca_visitados ?? 0) > 0 && 'text-orange-600')}>
                    {resumo?.indicadores.imoveis_nunca_visitados ?? 0}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Quarteirões nunca visitados</span>
                  <span className={cn('font-medium', (resumo?.indicadores.quarteiroes_nunca_visitados ?? 0) > 0 && 'text-orange-600')}>
                    {resumo?.indicadores.quarteiroes_nunca_visitados ?? 0}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabela de cobertura por quarteirão */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Map className="w-4 h-4 text-primary" />
            Cobertura por quarteirão
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingQ ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8" />)}
            </div>
          ) : !quarteiroes?.length ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nenhum quarteirão distribuído no ciclo ativo.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quarteirão</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Visitados</TableHead>
                  <TableHead className="text-right">Pendentes</TableHead>
                  <TableHead className="text-right">Cobertura</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quarteiroes.map(q => (
                  <TableRow key={q.quarteirao}>
                    <TableCell className="font-medium">{q.quarteirao}</TableCell>
                    <TableCell className="text-right">{q.total_imoveis}</TableCell>
                    <TableCell className="text-right">{q.visitados}</TableCell>
                    <TableCell className="text-right">{q.pendentes}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Progress value={q.percentual_cobertura} className="w-16 h-1.5" />
                        <span className="text-xs w-9 text-right">{q.percentual_cobertura}%</span>
                      </div>
                    </TableCell>
                    <TableCell>{statusBadge(q.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Tabela de cobertura por agente */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Desempenho por agente
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingA ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8" />)}
            </div>
          ) : !agentes?.length ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nenhum agente distribuído no ciclo ativo.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agente</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Visitados</TableHead>
                  <TableHead className="text-right">Pendentes</TableHead>
                  <TableHead className="text-right">Cobertura</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agentes.map(a => (
                  <TableRow key={a.agente_id}>
                    <TableCell className="font-medium">{a.nome}</TableCell>
                    <TableCell className="text-right">{a.total_imoveis}</TableCell>
                    <TableCell className="text-right">{a.visitados}</TableCell>
                    <TableCell className="text-right">{a.pendentes}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Progress value={a.percentual_cobertura} className="w-16 h-1.5" />
                        <span className="text-xs w-9 text-right">{a.percentual_cobertura}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Tabela de imóveis nunca visitados */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Home className="w-4 h-4 text-orange-500" />
            Imóveis nunca visitados
            {!loadingN && nuncaVisitados && nuncaVisitados.length > 0 && (
              <Badge variant="outline" className="ml-1 text-orange-700 border-orange-300 bg-orange-50">
                {nuncaVisitados.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingN ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8" />)}
            </div>
          ) : !nuncaVisitados?.length ? (
            <div className="p-6 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-green-400" />
              Todos os imóveis já foram visitados ao menos uma vez.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quarteirão</TableHead>
                  <TableHead>Endereço</TableHead>
                  <TableHead>Bairro</TableHead>
                  <TableHead>Agente responsável</TableHead>
                  <TableHead className="text-right">Dias sem vistoria</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nuncaVisitados.map(i => (
                  <TableRow key={i.id}>
                    <TableCell>{i.quarteirao ?? '—'}</TableCell>
                    <TableCell>
                      {[i.logradouro, i.numero].filter(Boolean).join(', ') || '—'}
                    </TableCell>
                    <TableCell>{i.bairro ?? '—'}</TableCell>
                    <TableCell>{i.agente_nome ?? <span className="text-muted-foreground">Sem agente</span>}</TableCell>
                    <TableCell className="text-right">
                      <span className={cn('font-medium', i.dias_sem_vistoria > 60 ? 'text-red-600' : i.dias_sem_vistoria > 30 ? 'text-orange-600' : '')}>
                        {i.dias_sem_vistoria}d
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
