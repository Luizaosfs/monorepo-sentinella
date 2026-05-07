import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ShieldAlert, RefreshCw, AlertTriangle, Activity, Globe, MapPin } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import AdminPageHeader from '@/components/AdminPageHeader';
import TablePagination from '@/components/TablePagination';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/services/api';
import { STALE } from '@/lib/queryConfig';

// ── Helpers visuais ──────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<string, { label: string; className: string }> = {
  info:     { label: 'Info',    className: 'bg-blue-100 text-blue-800' },
  warn:     { label: 'Atenção', className: 'bg-yellow-100 text-yellow-800' },
  error:    { label: 'Erro',    className: 'bg-red-100 text-red-800' },
  critical: { label: 'Crítico', className: 'bg-red-900 text-white' },
};

const EVENT_CONFIG: Record<string, { label: string; className: string }> = {
  LOGIN_SUCCESS:        { label: 'Login OK',       className: 'bg-green-100 text-green-800' },
  LOGIN_FAILED:         { label: 'Login Falhou',   className: 'bg-yellow-100 text-yellow-800' },
  TOKEN_INVALID:        { label: 'Token Inválido', className: 'bg-yellow-100 text-yellow-800' },
  ACCESS_DENIED:        { label: 'Acesso Negado',  className: 'bg-orange-100 text-orange-800' },
  TENANT_VIOLATION:     { label: 'Violação Tenant',className: 'bg-orange-100 text-orange-800' },
  RATE_LIMIT_BLOCKED:   { label: 'Rate Limit',     className: 'bg-purple-100 text-purple-800' },
  VALIDATION_FAILED:    { label: 'Validação',      className: 'bg-gray-100 text-gray-700' },
  INTERNAL_ERROR:       { label: 'Erro Interno',   className: 'bg-red-100 text-red-800' },
  PUBLIC_CHANNEL_ABUSE: { label: 'Abuso Canal',    className: 'bg-red-100 text-red-800' },
  CRITICAL_ACTION:      { label: 'Ação Crítica',   className: 'bg-red-900 text-white' },
};

function SeverityBadge({ severity }: { severity: string }) {
  const cfg = SEVERITY_CONFIG[severity] ?? { label: severity, className: 'bg-gray-100 text-gray-700' };
  return <Badge className={`text-xs ${cfg.className}`}>{cfg.label}</Badge>;
}

function EventBadge({ eventType }: { eventType: string }) {
  const cfg = EVENT_CONFIG[eventType] ?? { label: eventType, className: 'bg-gray-100 text-gray-700' };
  return <Badge className={`text-xs ${cfg.className}`}>{cfg.label}</Badge>;
}

function hora(iso: string) {
  try { return format(new Date(iso), 'dd/MM HH:mm:ss', { locale: ptBR }); }
  catch { return iso; }
}

// ── Componente principal ─────────────────────────────────────────────────────

const ALL = '__all__';

export default function AdminSecurityLogs() {
  const [page, setPage]           = useState(1);
  const [pageSize, setPageSize]   = useState(50);
  const [eventType, setEventType] = useState(ALL);
  const [severity, setSeverity]   = useState(ALL);
  const [ipDraft, setIpDraft]     = useState('');
  const [ip, setIp]               = useState('');
  const [days, setDays]           = useState(30);

  const listKey = { page, pageSize, days, eventType, severity, ip };

  const { data: list, isLoading: loadingList, refetch } = useQuery({
    queryKey: ['security-logs', listKey],
    queryFn: () => {
      const de = new Date();
      de.setDate(de.getDate() - days);
      return api.securityLogs.list({
        page,
        pageSize,
        de: de.toISOString(),
        ...(eventType !== ALL && { eventType }),
        ...(severity  !== ALL && { severity }),
        ...(ip && { ip }),
      });
    },
    staleTime: STALE.SHORT,
  });

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['security-logs-stats', days],
    queryFn:  () => api.securityLogs.stats(days),
    staleTime: STALE.MEDIUM,
  });

  const criticalCount = stats?.bySeverity
    .filter(s => s.severity === 'critical' || s.severity === 'error')
    .reduce((acc, s) => acc + s.total, 0) ?? 0;

  function aplicar() { setIp(ipDraft); setPage(1); }
  function limpar()  {
    setEventType(ALL); setSeverity(ALL);
    setIpDraft(''); setIp(''); setPage(1); setDays(30);
    setTimeout(() => refetch(), 0);
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Logs de Segurança"
        description="Eventos de autenticação, autorização e abusos da plataforma"
        icon={ShieldAlert}
        action={
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
          </Button>
        }
      />

      {/* ── Cards de stats ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" /> Total ({days}d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingList
              ? <Skeleton className="h-8 w-16" />
              : <p className="text-2xl font-bold">{list?.total ?? 0}</p>
            }
          </CardContent>
        </Card>

        <Card className={criticalCount > 0 ? 'border-red-300 bg-red-50' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-red-500" /> Erros / Críticos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStats
              ? <Skeleton className="h-8 w-16" />
              : <p className={`text-2xl font-bold ${criticalCount > 0 ? 'text-red-600' : ''}`}>{criticalCount}</p>
            }
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" /> IP mais ativo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStats ? <Skeleton className="h-6 w-28" /> : (
              <>
                <p className="text-sm font-mono font-semibold truncate">
                  {stats?.topIps[0]?.ip ?? '—'}
                </p>
                {stats?.topIps[0] && (
                  <p className="text-xs text-muted-foreground">{stats.topIps[0].total} eventos</p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> Endpoint mais atingido
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStats ? <Skeleton className="h-6 w-28" /> : (
              <>
                <p className="text-sm font-mono font-semibold truncate" title={stats?.topPaths[0]?.path ?? ''}>
                  {stats?.topPaths[0]?.path ?? '—'}
                </p>
                {stats?.topPaths[0] && (
                  <p className="text-xs text-muted-foreground">{stats.topPaths[0].total} eventos</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Filtros ────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Tipo de evento</p>
              <Select value={eventType} onValueChange={v => { setEventType(v); setPage(1); }}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos</SelectItem>
                  {Object.entries(EVENT_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Severidade</p>
              <Select value={severity} onValueChange={v => { setSeverity(v); setPage(1); }}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas</SelectItem>
                  {Object.entries(SEVERITY_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">IP</p>
              <Input
                className="w-36"
                placeholder="192.168.0.1"
                value={ipDraft}
                onChange={e => setIpDraft(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && aplicar()}
              />
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Período</p>
              <Select value={String(days)} onValueChange={v => setDays(Number(v))}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="30">30 dias</SelectItem>
                  <SelectItem value="60">60 dias</SelectItem>
                  <SelectItem value="90">90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button size="sm" onClick={aplicar}>Filtrar</Button>
            <Button size="sm" variant="ghost" onClick={limpar}>Limpar</Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Tabela ─────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-0">
          {loadingList ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">Hora</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="w-24">Severidade</TableHead>
                      <TableHead className="w-32">IP</TableHead>
                      <TableHead>Endpoint</TableHead>
                      <TableHead className="w-14 text-center">Cód.</TableHead>
                      <TableHead>Mensagem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!list?.data?.length ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                          Nenhum evento encontrado.
                        </TableCell>
                      </TableRow>
                    ) : list.data.map(row => (
                      <TableRow key={row.id}>
                        <TableCell className="text-xs font-mono whitespace-nowrap">
                          {hora(row.createdAt)}
                        </TableCell>
                        <TableCell>
                          <EventBadge eventType={row.eventType} />
                        </TableCell>
                        <TableCell>
                          <SeverityBadge severity={row.severity} />
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {row.ip ?? '—'}
                        </TableCell>
                        <TableCell className="text-xs font-mono whitespace-nowrap">
                          {row.method && row.path
                            ? `${row.method} ${row.path}`
                            : row.path ?? '—'}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.statusCode ? (
                            <span className={`text-xs font-mono font-bold ${
                              row.statusCode >= 500 ? 'text-red-600'    :
                              row.statusCode >= 400 ? 'text-yellow-700' : 'text-green-700'
                            }`}>
                              {row.statusCode}
                            </span>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-xs max-w-xs truncate" title={row.message}>
                          {row.message}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {list && list.totalPages > 1 && (
                <div className="border-t p-3">
                  <TablePagination
                    page={page}
                    totalPages={list.totalPages}
                    total={list.total}
                    pageSize={pageSize}
                    onGoTo={setPage}
                    onNext={() => setPage(p => Math.min(p + 1, list.totalPages))}
                    onPrev={() => setPage(p => Math.max(p - 1, 1))}
                    onPageSizeChange={size => { setPageSize(size); setPage(1); }}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
