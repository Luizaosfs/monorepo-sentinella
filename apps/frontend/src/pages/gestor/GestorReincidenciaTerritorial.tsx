import { useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Home,
  Map,
  RefreshCw,
  TrendingUp,
  Users,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  useReincidenciaBairros,
  useReincidenciaImoveis,
  useReincidenciaQuarteiroes,
  useResumoReincidencia,
} from '@/hooks/queries/useReincidenciaTerritorial';
import type { CriticidadeReincidencia, PeriodoFilter } from '@/services/api/domains/reincidencia-territorial';

// ── criticidade badge ───────────────────────────────────────────────────────

function CritBadge({ v }: { v: CriticidadeReincidencia }) {
  if (v === 'alta') return <Badge className="bg-red-100 text-red-800 border-red-200">Alta</Badge>;
  if (v === 'media') return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Média</Badge>;
  return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Baixa</Badge>;
}

// ── período preset ──────────────────────────────────────────────────────────

type Preset = '30d' | '90d' | '180d';

function periodoFromPreset(preset: Preset): PeriodoFilter {
  const fim = new Date();
  const dias = preset === '30d' ? 30 : preset === '90d' ? 90 : 180;
  return {
    dataInicio: subDays(fim, dias).toISOString(),
    dataFim: fim.toISOString(),
  };
}

// ── KPI card ────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  loading,
  highlight,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  sub?: string;
  loading?: boolean;
  highlight?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start gap-3">
          <div className={cn('p-2 rounded-lg', highlight ? 'bg-red-100' : 'bg-primary/10')}>
            <Icon className={cn('w-5 h-5', highlight ? 'text-red-600' : 'text-primary')} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
            {loading
              ? <Skeleton className="h-7 w-16" />
              : <p className={cn('text-2xl font-bold leading-tight', highlight && 'text-red-600')}>{value}</p>}
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── page ────────────────────────────────────────────────────────────────────

export default function GestorReincidenciaTerritorial() {
  const [preset, setPreset] = useState<Preset>('90d');
  const filtro = useMemo(() => periodoFromPreset(preset), [preset]);

  const { data: resumo, isLoading: loadingR, refetch } = useResumoReincidencia(filtro);
  const { data: imoveis, isLoading: loadingI } = useReincidenciaImoveis(filtro);
  const { data: quarteiroes, isLoading: loadingQ } = useReincidenciaQuarteiroes(filtro);
  const { data: bairros, isLoading: loadingB } = useReincidenciaBairros(filtro);

  const periodoLabel = resumo
    ? `${format(new Date(resumo.periodo.data_inicio), 'dd/MM/yyyy', { locale: ptBR })} – ${format(new Date(resumo.periodo.data_fim), 'dd/MM/yyyy', { locale: ptBR })}`
    : '…';

  const temAlta = (resumo?.criticidade.alta ?? 0) > 0;
  const temMedia = (resumo?.criticidade.media ?? 0) > 0;
  const estadoGeral = temAlta ? 'critico' : temMedia ? 'atencao' : 'normal';

  return (
    <div className="space-y-6 p-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Reincidência Territorial</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{periodoLabel}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Presets */}
          {(['30d', '90d', '180d'] as Preset[]).map(p => (
            <Button
              key={p}
              variant={preset === p ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPreset(p)}
            >
              {p === '30d' ? '30 dias' : p === '90d' ? '90 dias' : '180 dias'}
            </Button>
          ))}
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Estado operacional */}
      {!loadingR && (
        <div className={cn(
          'rounded-xl border px-4 py-3 flex items-center gap-3',
          estadoGeral === 'critico' && 'border-red-300 bg-red-50 dark:bg-red-950/20',
          estadoGeral === 'atencao' && 'border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20',
          estadoGeral === 'normal' && 'border-green-300 bg-green-50 dark:bg-green-950/20',
        )}>
          {estadoGeral === 'critico' && <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />}
          {estadoGeral === 'atencao' && <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0" />}
          {estadoGeral === 'normal' && <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />}
          <p className="text-sm font-medium">
            {estadoGeral === 'critico' && `Situação crítica — ${resumo?.criticidade.alta} imóvel(is) com alta reincidência`}
            {estadoGeral === 'atencao' && `Atenção — ${resumo?.criticidade.media} imóvel(is) com reincidência média`}
            {estadoGeral === 'normal' && 'Baixa reincidência — nenhum imóvel em nível crítico ou médio'}
          </p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard icon={TrendingUp} label="Total ocorrências" value={resumo?.municipio.total_ocorrencias ?? '—'} loading={loadingR} />
        <KpiCard icon={Home} label="Imóveis reincidentes" value={resumo?.municipio.imoveis_reincidentes ?? '—'} loading={loadingR} highlight={temAlta} />
        <KpiCard icon={Map} label="Quarteirões" value={resumo?.municipio.quarteiroes_reincidentes ?? '—'} loading={loadingR} />
        <KpiCard icon={Building2} label="Bairros" value={resumo?.municipio.bairros_reincidentes ?? '—'} loading={loadingR} />
        <KpiCard icon={Users} label="% reincidência" value={`${resumo?.municipio.percentual_reincidencia ?? 0}%`} sub="dos imóveis com foco" loading={loadingR} />
      </div>

      {/* Criticidade chips */}
      {!loadingR && resumo && (
        <div className="flex gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
            Baixa: <strong>{resumo.criticidade.baixa}</strong>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block" />
            Média: <strong>{resumo.criticidade.media}</strong>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
            Alta: <strong>{resumo.criticidade.alta}</strong>
          </div>
        </div>
      )}

      {/* Ranking imóveis */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Home className="w-4 h-4 text-primary" />
            Imóveis reincidentes
            {!loadingI && imoveis && imoveis.length > 0 && (
              <Badge variant="outline" className="ml-1">{imoveis.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingI
            ? <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
            : !imoveis?.length
              ? <div className="p-6 text-center text-sm text-muted-foreground flex flex-col items-center gap-2"><CheckCircle2 className="w-7 h-7 text-green-400" />Nenhum imóvel reincidente no período.</div>
              : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Endereço</TableHead>
                      <TableHead>Bairro</TableHead>
                      <TableHead>Quarteirão</TableHead>
                      <TableHead className="text-right">Ocorrências</TableHead>
                      <TableHead>Criticidade</TableHead>
                      <TableHead>Último foco</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {imoveis.map(i => (
                      <TableRow key={i.imovel_id}>
                        <TableCell className="font-medium">{i.endereco}</TableCell>
                        <TableCell>{i.bairro ?? '—'}</TableCell>
                        <TableCell>{i.quarteirao ?? '—'}</TableCell>
                        <TableCell className="text-right font-bold">{i.total_ocorrencias}</TableCell>
                        <TableCell><CritBadge v={i.criticidade} /></TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {format(new Date(i.ultimo_foco_em), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
        </CardContent>
      </Card>

      {/* Ranking quarteirões */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Map className="w-4 h-4 text-primary" />
            Quarteirões reincidentes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingQ
            ? <div className="p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
            : !quarteiroes?.length
              ? <div className="p-6 text-center text-sm text-muted-foreground">Nenhum quarteirão reincidente no período.</div>
              : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quarteirão</TableHead>
                      <TableHead>Bairro</TableHead>
                      <TableHead className="text-right">Ocorrências</TableHead>
                      <TableHead className="text-right">Imóveis reincid.</TableHead>
                      <TableHead>Criticidade</TableHead>
                      <TableHead>Último foco</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quarteiroes.map(q => (
                      <TableRow key={q.quarteirao}>
                        <TableCell className="font-medium">{q.quarteirao}</TableCell>
                        <TableCell>{q.bairro ?? '—'}</TableCell>
                        <TableCell className="text-right">{q.total_ocorrencias}</TableCell>
                        <TableCell className="text-right">{q.imoveis_reincidentes}</TableCell>
                        <TableCell><CritBadge v={q.criticidade} /></TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {format(new Date(q.ultimo_foco_em), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
        </CardContent>
      </Card>

      {/* Ranking bairros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            Bairros reincidentes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingB
            ? <div className="p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
            : !bairros?.length
              ? <div className="p-6 text-center text-sm text-muted-foreground">Nenhum bairro reincidente no período.</div>
              : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bairro</TableHead>
                      <TableHead className="text-right">Ocorrências</TableHead>
                      <TableHead className="text-right">Imóveis reincid.</TableHead>
                      <TableHead className="text-right">Quarteirões reincid.</TableHead>
                      <TableHead>Criticidade</TableHead>
                      <TableHead>Último foco</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bairros.map(b => (
                      <TableRow key={b.bairro}>
                        <TableCell className="font-medium">{b.bairro}</TableCell>
                        <TableCell className="text-right">{b.total_ocorrencias}</TableCell>
                        <TableCell className="text-right">{b.imoveis_reincidentes}</TableCell>
                        <TableCell className="text-right">{b.quarteiroes_reincidentes}</TableCell>
                        <TableCell><CritBadge v={b.criticidade} /></TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {format(new Date(b.ultimo_foco_em), 'dd/MM/yyyy', { locale: ptBR })}
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
