import { Link } from 'react-router-dom';
import {
  Building2,
  Target,
  Gauge,
  ListTodo,
  HeartPulse,
  AlertTriangle,
  LayoutDashboard,
  ArrowRight,
  Globe2,
  Plane,
  Megaphone,
} from 'lucide-react';
import AdminPageHeader from '@/components/AdminPageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useComparativoMunicipios } from '@/hooks/queries/useComparativoMunicipios';
import { useClienteQuotasAll } from '@/hooks/queries/useClienteQuotas';
import { useAdminClientesResumo, useAdminJobQueueResumo } from '@/hooks/queries/useAdminPlatformDashboard';
import { useSystemHealthStatus, useSystemAlerts } from '@/hooks/queries/useSystemHealth';
import { cn } from '@/lib/utils';

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  loading,
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
  className?: string;
}) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="flex flex-row items-center gap-3 pb-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <p className="text-2xl font-bold tabular-nums">{value}</p>
        )}
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

const atalhos = [
  { to: '/admin/clientes', label: 'Prefeituras', icon: Building2, desc: 'Cadastro e configuração' },
  { to: '/admin/quotas', label: 'Quotas', icon: Gauge, desc: 'Limites e uso por cliente' },
  { to: '/admin/painel-municipios', label: 'Comparativo', icon: Globe2, desc: 'Focos por município (7 dias)' },
  { to: '/admin/job-queue', label: 'Fila de jobs', icon: ListTodo, desc: 'Processamento assíncrono' },
  { to: '/admin/saude-sistema', label: 'Saúde do sistema', icon: HeartPulse, desc: 'Health checks e alertas' },
  { to: '/admin/pipeline-status', label: 'Pipeline drone', icon: Plane, desc: 'Processamento de voos' },
  { to: '/admin/canal-cidadao', label: 'Canal cidadão', icon: Megaphone, desc: 'QR e denúncias' },
];

export default function AdminPlatformDashboard() {
  const { data: clientes, isLoading: lc } = useAdminClientesResumo();
  const { data: comparativo, isLoading: mc } = useComparativoMunicipios();
  const { data: quotas, isLoading: qc } = useClienteQuotasAll();
  const { data: jobs, isLoading: jc } = useAdminJobQueueResumo();
  const { data: health, isLoading: hc } = useSystemHealthStatus();
  const { data: alertas, isLoading: la } = useSystemAlerts(true);

  const ativos = clientes?.filter((c) => c.ativo).length ?? 0;
  const totalCad = clientes?.length ?? 0;
  const focos7d = comparativo?.reduce((s, r) => s + r.total, 0) ?? 0;
  const munComDados = comparativo?.length ?? 0;

  const quotasCriticas =
    quotas?.filter(
      (u) =>
        u.voos_excedido ||
        u.levantamentos_excedido ||
        u.itens_excedido ||
        u.usuarios_excedido ||
        u.vistorias_excedido ||
        u.ia_calls_excedido,
    ).length ?? 0;

  const jobsPendente = jobs?.filter((j) => j.status === 'pendente').length ?? 0;
  const jobsFalhou = jobs?.filter((j) => j.status === 'falhou').length ?? 0;

  const healthRuim = health?.filter((h) => h.status !== 'ok').length ?? 0;
  const alertasAtivos = alertas?.length ?? 0;

  const loadingKpi = lc || mc || qc;

  return (
    <div className="space-y-8 p-4 lg:p-6 max-w-6xl mx-auto">
      <AdminPageHeader
        title="Painel da plataforma"
        description="Visão consolidada da operação SaaS: prefeituras, quotas, fila e saúde dos serviços. O painel operacional por município continua em “Painel do município” abaixo."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Prefeituras ativas"
          value={loadingKpi ? '—' : ativos}
          hint={totalCad ? `${totalCad} cadastradas no total` : undefined}
          icon={Building2}
          loading={lc}
        />
        <Kpi
          label="Focos (7 dias)"
          value={loadingKpi ? '—' : focos7d}
          hint={munComDados ? `${munComDados} municípios com registros` : 'Sem dados no período'}
          icon={Target}
          loading={mc}
        />
        <Kpi
          label="Quotas em excesso"
          value={loadingKpi ? '—' : quotasCriticas}
          hint="Clientes com alguma métrica acima do limite"
          icon={Gauge}
          loading={qc}
        />
        <Kpi
          label="Alertas abertos"
          value={alertasAtivos}
          hint="Monitoramento QW-12"
          icon={AlertTriangle}
          loading={la}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ListTodo className="h-4 w-4" />
              Fila de jobs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {jc ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <>
                <div className="flex gap-6 text-sm">
                  <span>
                    <strong className="tabular-nums">{jobsPendente}</strong>{' '}
                    <span className="text-muted-foreground">pendentes</span>
                  </span>
                  <span>
                    <strong className="tabular-nums text-destructive">{jobsFalhou}</strong>{' '}
                    <span className="text-muted-foreground">falhos</span>
                  </span>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/admin/job-queue">
                    Abrir fila <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <HeartPulse className="h-4 w-4" />
              Saúde dos serviços
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {hc ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {health?.length ? (
                    <>
                      <strong className="text-foreground">{health.length}</strong> serviços monitorados
                      {healthRuim > 0 && (
                        <>
                          {' · '}
                          <span className="text-amber-600 font-medium">{healthRuim} com aviso ou erro</span>
                        </>
                      )}
                    </>
                  ) : (
                    'Nenhum registro de health check ainda.'
                  )}
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/admin/saude-sistema">
                    Saúde do sistema <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Painel operacional do município
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            O dashboard com levantamentos, SLA e gráficos por <strong>prefeitura</strong> usa o cliente selecionado no topo da barra lateral.
            Escolha o município e abra o painel municipal.
          </p>
          <Button asChild>
            <Link to="/dashboard">
              Abrir painel do município selecionado
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Atalhos
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {atalhos.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className="group flex items-start gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/50 hover:border-primary/30"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted group-hover:bg-primary/10">
                <a.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm group-hover:text-primary flex items-center gap-1">
                  {a.label}
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{a.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
