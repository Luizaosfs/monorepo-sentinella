import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import { useClienteAtivo } from '@/hooks/useClienteAtivo';
import { usePagination } from '@/hooks/usePagination';
import AdminPageHeader from '@/components/AdminPageHeader';
import TablePagination from '@/components/TablePagination';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, History, Search, RefreshCw, MapPin, Repeat } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface HistoricoRow {
  levantamento_item_id: string;
  levantamento_id: string;
  latitude: number | null;
  longitude: number | null;
  item: string | null;
  risco: string | null;
  prioridade: string | null;
  acao: string | null;
  endereco_curto: string | null;
  endereco_completo: string | null;
  item_data_hora: string | null;
  item_created_at: string;
  cliente_id: string;
  levantamento_tipo_entrada: string | null;
  operacao_id: string | null;
  operacao_status: string | null;
  operacao_iniciado_em: string | null;
  operacao_concluido_em: string | null;
  operacao_observacao: string | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  responsavel_email: string | null;
}

// ── Tipos agrupados ───────────────────────────────────────────────────────────

interface PontoRecorrente {
  chave: string;               // "lat,lon" arredondado a 3 casas
  latitude: number;
  longitude: number;
  endereco: string;
  ocorrencias: number;
  ultima_ocorrencia: string;
  risco_alto: number;
  risco_medio: number;
  risco_baixo: number;
  concluidos: number;
  taxa_resolucao: number;      // % concluídos / total
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const RISCO_BADGE: Record<string, string> = {
  alto:  'bg-destructive/15 text-destructive',
  medio: 'bg-warning/15 text-warning',
  baixo: 'bg-success/15 text-success',
};

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  pendente:      { label: 'Pendente',      color: 'bg-muted text-muted-foreground' },
  em_andamento:  { label: 'Em Andamento',  color: 'bg-info/15 text-info' },
  concluido:     { label: 'Concluído',     color: 'bg-success/15 text-success' },
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

const AdminHistoricoAtendimento = () => {
  const { clienteId } = useClienteAtivo();
  const [search, setSearch] = useState('');
  const [filterRisco, setFilterRisco] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTipo, setFilterTipo] = useState('all');

  const { data: rows = [], isLoading, refetch } = useQuery<HistoricoRow[]>({
    queryKey: ['historico_atendimento', clienteId],
    queryFn: async () => {
      if (!clienteId) return [];
      const data = await api.historicoAtendimento.listByCliente(clienteId);
      return (data as HistoricoRow[]) ?? [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      const matchSearch = !q ||
        r.item?.toLowerCase().includes(q) ||
        r.endereco_curto?.toLowerCase().includes(q) ||
        r.endereco_completo?.toLowerCase().includes(q) ||
        r.responsavel_nome?.toLowerCase().includes(q);
      const matchRisco  = filterRisco  === 'all' || r.risco?.toLowerCase() === filterRisco;
      const matchStatus = filterStatus === 'all' || r.operacao_status === filterStatus || (filterStatus === 'sem_operacao' && !r.operacao_id);
      const matchTipo   = filterTipo   === 'all' || (r.levantamento_tipo_entrada?.toUpperCase() ?? 'MANUAL') === filterTipo;
      return matchSearch && matchRisco && matchStatus && matchTipo;
    });
  }, [rows, search, filterRisco, filterStatus, filterTipo]);

  // Métricas simples
  const metrics = useMemo(() => {
    const total       = filtered.length;
    const concluidos  = filtered.filter((r) => r.operacao_status === 'concluido').length;
    const pendentes   = filtered.filter((r) => r.operacao_status === 'pendente' || !r.operacao_id).length;
    const altos       = filtered.filter((r) => r.risco?.toLowerCase() === 'alto').length;
    return { total, concluidos, pendentes, altos };
  }, [filtered]);

  // ── Pontos recorrentes: agrupado por lat/lon arredondado (±~111m) ────────────
  const pontosRecorrentes = useMemo<PontoRecorrente[]>(() => {
    const map = new Map<string, {
      lat: number; lon: number; endereco: string; rows: HistoricoRow[];
    }>();

    for (const r of rows) {
      if (r.latitude == null || r.longitude == null) continue;
      const chave = `${r.latitude.toFixed(3)},${r.longitude.toFixed(3)}`;
      if (!map.has(chave)) {
        map.set(chave, {
          lat: r.latitude,
          lon: r.longitude,
          endereco: r.endereco_curto ?? r.endereco_completo ?? chave,
          rows: [],
        });
      }
      map.get(chave)!.rows.push(r);
    }

    return Array.from(map.entries())
      .map(([chave, g]) => {
        const ocorrencias = g.rows.length;
        const concluidos  = g.rows.filter((r) => r.operacao_status === 'concluido').length;
        const datas       = g.rows.map((r) => r.item_data_hora ?? r.item_created_at).sort().reverse();
        return {
          chave,
          latitude:         g.lat,
          longitude:        g.lon,
          endereco:         g.endereco,
          ocorrencias,
          ultima_ocorrencia: datas[0] ?? '',
          risco_alto:   g.rows.filter((r) => r.risco?.toLowerCase() === 'alto').length,
          risco_medio:  g.rows.filter((r) => r.risco?.toLowerCase() === 'medio').length,
          risco_baixo:  g.rows.filter((r) => r.risco?.toLowerCase() === 'baixo').length,
          concluidos,
          taxa_resolucao: ocorrencias > 0 ? Math.round((concluidos / ocorrencias) * 100) : 0,
        };
      })
      .filter((p) => p.ocorrencias > 1)           // só pontos com recorrência
      .sort((a, b) => b.ocorrencias - a.ocorrencias);
  }, [rows]);

  const { page, totalPages, paginated, goTo, next, prev, total, pageSize, setPageSize } = usePagination(filtered, 20);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in overflow-x-hidden min-w-0 max-w-full">
      <AdminPageHeader
        title="Histórico de Atendimento"
        description="Todas as ocorrências registradas por localização, com histórico de operações e responsáveis."
        icon={History}
      />

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Total de registros" value={metrics.total}       color="text-primary" />
        <MetricCard label="Concluídos"          value={metrics.concluidos}  color="text-success" />
        <MetricCard label="Pendentes"           value={metrics.pendentes}   color="text-warning" />
        <MetricCard label="Risco alto"          value={metrics.altos}       color="text-destructive" />
      </div>

      <Tabs defaultValue="lista" className="space-y-5">
        <TabsList className="grid w-full max-w-xs grid-cols-2">
          <TabsTrigger value="lista" className="gap-1.5 text-xs">
            <History className="w-3.5 h-3.5" /> Lista
          </TabsTrigger>
          <TabsTrigger value="recorrentes" className="gap-1.5 text-xs">
            <Repeat className="w-3.5 h-3.5" /> Recorrentes
            {pontosRecorrentes.length > 0 && (
              <Badge className="ml-1 text-[9px] h-4 px-1 bg-destructive text-destructive-foreground">
                {pontosRecorrentes.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="space-y-5">
      {/* Filtros */}
      <Card className="card-premium">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar item, endereço, responsável..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={filterRisco} onValueChange={setFilterRisco}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Risco" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os riscos</SelectItem>
                <SelectItem value="alto">Alto</SelectItem>
                <SelectItem value="medio">Médio</SelectItem>
                <SelectItem value="baixo">Baixo</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Status operação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="sem_operacao">Sem operação</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="em_andamento">Em Andamento</SelectItem>
                <SelectItem value="concluido">Concluído</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="DRONE">Drone</SelectItem>
                <SelectItem value="MANUAL">Manual</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="icon" onClick={() => refetch()} title="Atualizar">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card className="card-premium overflow-hidden">
        <CardHeader className="p-4 border-b border-border/40">
          <CardTitle className="text-sm font-semibold">
            {total} registro{total !== 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Desktop */}
          <div className="hidden lg:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item / Endereço</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Risco</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Operação</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Concluído em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((r) => {
                  const riscoCls = RISCO_BADGE[r.risco?.toLowerCase() ?? ''] ?? 'bg-muted text-muted-foreground';
                  const opStatus = r.operacao_status ? STATUS_BADGE[r.operacao_status] : null;
                  return (
                    <TableRow key={r.levantamento_item_id}>
                      <TableCell>
                        <p className="font-medium text-sm">{r.item || '—'}</p>
                        {r.endereco_curto && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3" /> {r.endereco_curto}
                          </p>
                        )}
                        {r.latitude && r.longitude && (
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {r.levantamento_tipo_entrada ?? 'MANUAL'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {r.risco ? (
                          <Badge className={cn('text-[10px] font-bold border-0', riscoCls)}>
                            {r.risco}
                          </Badge>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.prioridade ?? '—'}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {fmtDate(r.item_data_hora ?? r.item_created_at)}
                      </TableCell>
                      <TableCell>
                        {opStatus ? (
                          <Badge className={cn('text-[10px] font-bold border-0', opStatus.color)}>
                            {opStatus.label}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sem operação</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.responsavel_nome ?? '—'}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {fmtDate(r.operacao_concluido_em)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {paginated.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-sm">
                      Nenhum registro encontrado com os filtros selecionados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile */}
          <div className="lg:hidden divide-y divide-border/40">
            {paginated.map((r) => {
              const riscoCls = RISCO_BADGE[r.risco?.toLowerCase() ?? ''] ?? 'bg-muted text-muted-foreground';
              const opStatus = r.operacao_status ? STATUS_BADGE[r.operacao_status] : null;
              return (
                <div key={r.levantamento_item_id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm">{r.item || '—'}</p>
                      {r.endereco_curto && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {r.endereco_curto}
                        </p>
                      )}
                    </div>
                    {r.risco && (
                      <Badge className={cn('text-[10px] font-bold border-0 shrink-0', riscoCls)}>
                        {r.risco}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{fmtDate(r.item_data_hora ?? r.item_created_at)}</span>
                    <span>·</span>
                    <span>{r.levantamento_tipo_entrada ?? 'MANUAL'}</span>
                    {r.prioridade && <><span>·</span><span>{r.prioridade}</span></>}
                  </div>
                  <div className="flex items-center justify-between">
                    {opStatus ? (
                      <Badge className={cn('text-[10px] font-bold border-0', opStatus.color)}>
                        {opStatus.label}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sem operação</span>
                    )}
                    {r.responsavel_nome && (
                      <span className="text-xs text-muted-foreground">{r.responsavel_nome}</span>
                    )}
                  </div>
                  {r.operacao_concluido_em && (
                    <p className="text-[10px] text-muted-foreground">
                      Concluído: {fmtDate(r.operacao_concluido_em)}
                    </p>
                  )}
                </div>
              );
            })}
            {paginated.length === 0 && (
              <div className="text-center py-10 text-muted-foreground text-sm">
                Nenhum registro encontrado.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

        {totalPages > 1 && (
          <TablePagination
            page={page} totalPages={totalPages} total={total}
            pageSize={pageSize} onGoTo={goTo} onNext={next} onPrev={prev}
            onPageSizeChange={setPageSize}
          />
        )}
        </TabsContent>

        {/* ── Aba: Pontos Recorrentes ── */}
        <TabsContent value="recorrentes" className="space-y-4">
          <Card className="card-premium overflow-hidden">
            <CardHeader className="p-4 border-b border-border/40">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Repeat className="w-4 h-4 text-destructive" />
                {pontosRecorrentes.length} ponto{pontosRecorrentes.length !== 1 ? 's' : ''} com mais de 1 ocorrência
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {pontosRecorrentes.length === 0 ? (
                <p className="text-center py-10 text-muted-foreground text-sm">
                  Nenhum ponto com ocorrências repetidas no histórico.
                </p>
              ) : (
                <>
                  {/* Desktop */}
                  <div className="hidden lg:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Local</TableHead>
                          <TableHead className="text-center">Ocorrências</TableHead>
                          <TableHead>Distribuição de risco</TableHead>
                          <TableHead className="text-center">Resolução</TableHead>
                          <TableHead>Última ocorrência</TableHead>
                          <TableHead className="text-xs text-muted-foreground">Coordenadas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pontosRecorrentes.map((p) => (
                          <TableRow key={p.chave} className={cn(p.risco_alto > 0 && 'bg-destructive/5')}>
                            <TableCell>
                              <p className="font-medium text-sm flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                                {p.endereco}
                              </p>
                            </TableCell>
                            <TableCell className="text-center">
                              <span className={cn(
                                'text-lg font-black tabular-nums',
                                p.ocorrencias >= 5 ? 'text-destructive' : p.ocorrencias >= 3 ? 'text-warning' : 'text-foreground'
                              )}>
                                {p.ocorrencias}x
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5 text-xs">
                                {p.risco_alto > 0 && (
                                  <Badge className="bg-destructive/15 text-destructive border-0 text-[9px]">
                                    {p.risco_alto} alto{p.risco_alto !== 1 ? 's' : ''}
                                  </Badge>
                                )}
                                {p.risco_medio > 0 && (
                                  <Badge className="bg-warning/15 text-warning border-0 text-[9px]">
                                    {p.risco_medio} médio{p.risco_medio !== 1 ? 's' : ''}
                                  </Badge>
                                )}
                                {p.risco_baixo > 0 && (
                                  <Badge className="bg-success/15 text-success border-0 text-[9px]">
                                    {p.risco_baixo} baixo{p.risco_baixo !== 1 ? 's' : ''}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={p.taxa_resolucao} className="w-16 h-1.5" />
                                <span className={cn(
                                  'text-xs font-bold tabular-nums',
                                  p.taxa_resolucao >= 80 ? 'text-success' : p.taxa_resolucao >= 50 ? 'text-warning' : 'text-destructive'
                                )}>
                                  {p.taxa_resolucao}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs whitespace-nowrap">
                              {fmtDate(p.ultima_ocorrencia)}
                            </TableCell>
                            <TableCell className="text-[10px] font-mono text-muted-foreground">
                              {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile */}
                  <div className="lg:hidden divide-y divide-border/40">
                    {pontosRecorrentes.map((p) => (
                      <div key={p.chave} className={cn('p-4 space-y-2', p.risco_alto > 0 && 'bg-destructive/5')}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-sm flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                            {p.endereco}
                          </p>
                          <span className={cn(
                            'text-lg font-black tabular-nums shrink-0',
                            p.ocorrencias >= 5 ? 'text-destructive' : p.ocorrencias >= 3 ? 'text-warning' : 'text-foreground'
                          )}>
                            {p.ocorrencias}x
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {p.risco_alto > 0 && (
                            <Badge className="bg-destructive/15 text-destructive border-0 text-[9px]">{p.risco_alto} alto</Badge>
                          )}
                          {p.risco_medio > 0 && (
                            <Badge className="bg-warning/15 text-warning border-0 text-[9px]">{p.risco_medio} médio</Badge>
                          )}
                          {p.risco_baixo > 0 && (
                            <Badge className="bg-success/15 text-success border-0 text-[9px]">{p.risco_baixo} baixo</Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Progress value={p.taxa_resolucao} className="w-16 h-1.5" />
                            <span className={cn(
                              'font-bold',
                              p.taxa_resolucao >= 80 ? 'text-success' : p.taxa_resolucao >= 50 ? 'text-warning' : 'text-destructive'
                            )}>
                              {p.taxa_resolucao}% resolvido
                            </span>
                          </div>
                          <span>{fmtDate(p.ultima_ocorrencia)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

function MetricCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card className="stat-card">
      <CardContent className="p-4">
        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className={cn('text-xl font-black tabular-nums mt-1', color)}>{value}</p>
      </CardContent>
    </Card>
  );
}

export default AdminHistoricoAtendimento;
