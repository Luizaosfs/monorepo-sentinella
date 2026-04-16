import { useState } from 'react';
import { HeartPulse, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Clock, Bell, BellOff } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AdminPageHeader from '@/components/AdminPageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  useSystemHealthStatus,
  useSystemAlerts,
  useResolverAlertaMutation,
  useTriggerHealthCheckMutation,
} from '@/hooks/queries/useSystemHealth';
import type { SystemHealthLog, SystemAlert, SystemHealthStatus, SystemAlertNivel } from '@/types/database';

// ── Helpers visuais ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<SystemHealthStatus, { label: string; color: string; icon: React.ReactNode }> = {
  ok: { label: 'OK', color: 'bg-green-100 text-green-800 border-green-200', icon: <CheckCircle2 className="h-4 w-4 text-green-600" /> },
  aviso: { label: 'Aviso', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: <AlertTriangle className="h-4 w-4 text-yellow-600" /> },
  erro: { label: 'Erro', color: 'bg-red-100 text-red-800 border-red-200', icon: <XCircle className="h-4 w-4 text-red-600" /> },
};

const NIVEL_CONFIG: Record<SystemAlertNivel, { label: string; color: string }> = {
  info: { label: 'Info', color: 'bg-blue-100 text-blue-800' },
  warning: { label: 'Atenção', color: 'bg-yellow-100 text-yellow-800' },
  critical: { label: 'Crítico', color: 'bg-red-100 text-red-800' },
};

const SERVICO_LABELS: Record<string, string> = {
  banco: 'Banco de dados',
  cnes_sync: 'Sincronização CNES',
  sla_erros: 'Erros de SLA',
  offline_falhas: 'Fila offline',
  relatorio: 'Relatório semanal',
  email_config: 'Configuração de e-mail',
  cloudinary: 'Cloudinary (armazenamento)',
};

function servicoLabel(servico: string) {
  return SERVICO_LABELS[servico] ?? servico;
}

function distancia(isoDate: string) {
  return formatDistanceToNow(new Date(isoDate), { locale: ptBR, addSuffix: true });
}

// ── Card de serviço ──────────────────────────────────────────────────────────

function ServicoCard({ log }: { log: SystemHealthLog }) {
  const cfg = STATUS_CONFIG[log.status] ?? STATUS_CONFIG.aviso;
  return (
    <div className={`flex items-center gap-3 rounded-lg border p-4 ${cfg.color}`}>
      {cfg.icon}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{servicoLabel(log.servico)}</p>
        <p className="text-xs opacity-70 flex items-center gap-1 mt-0.5">
          <Clock className="h-3 w-3" />
          {distancia(log.criado_em)}
        </p>
      </div>
      <Badge variant="outline" className={`text-xs shrink-0 ${cfg.color}`}>
        {cfg.label}
      </Badge>
    </div>
  );
}

function ServicoCardSkeleton() {
  return <Skeleton className="h-16 w-full rounded-lg" />;
}

// ── Linha de alerta ──────────────────────────────────────────────────────────

function AlertRow({ alerta, onResolver }: { alerta: SystemAlert; onResolver: (id: string) => void }) {
  const cfg = NIVEL_CONFIG[alerta.nivel] ?? NIVEL_CONFIG.warning;
  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-0">
      <Badge className={`mt-0.5 shrink-0 text-xs ${cfg.color}`}>{cfg.label}</Badge>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{servicoLabel(alerta.servico)}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{alerta.mensagem}</p>
        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {distancia(alerta.criado_em)}
        </p>
      </div>
      {!alerta.resolvido && (
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 h-7 text-xs"
          onClick={() => onResolver(alerta.id)}
        >
          Resolver
        </Button>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function AdminSaudeSistema() {
  const { toast } = useToast();
  const [mostrarResolvidos, setMostrarResolvidos] = useState(false);

  const { data: statusServicos = [], isLoading: loadingStatus } = useSystemHealthStatus();
  const { data: alertas = [], isLoading: loadingAlertas } = useSystemAlerts(!mostrarResolvidos);

  const resolverMutation = useResolverAlertaMutation();
  const triggerMutation = useTriggerHealthCheckMutation();

  async function handleVerificarAgora() {
    try {
      const resultado = await triggerMutation.mutateAsync();
      toast({
        title: 'Verificação concluída',
        description: `Status geral: ${resultado.nivel_geral === 'ok' ? '✅ tudo OK' : resultado.nivel_geral === 'aviso' ? '⚠️ avisos detectados' : '🔴 erros detectados'}`,
      });
    } catch {
      toast({ title: 'Erro ao executar verificação', variant: 'destructive' });
    }
  }

  async function handleResolver(id: string) {
    try {
      await resolverMutation.mutateAsync(id);
      toast({ title: 'Alerta marcado como resolvido' });
    } catch {
      toast({ title: 'Erro ao resolver alerta', variant: 'destructive' });
    }
  }

  // Contadores para o resumo no header
  const totalErros = statusServicos.filter(s => s.status === 'erro').length;
  const totalAvisos = statusServicos.filter(s => s.status === 'aviso').length;
  const alertasAtivos = alertas.filter(a => !a.resolvido).length;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Saúde do Sistema"
        description="Monitoramento em tempo real dos serviços críticos da plataforma."
        icon={HeartPulse}
        actions={
          <Button
            onClick={handleVerificarAgora}
            disabled={triggerMutation.isPending}
            size="sm"
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${triggerMutation.isPending ? 'animate-spin' : ''}`} />
            Verificar agora
          </Button>
        }
      />

      {/* Resumo geral */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Serviços OK</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {statusServicos.filter(s => s.status === 'ok').length}
              <span className="text-sm font-normal text-muted-foreground ml-1">/ {statusServicos.length}</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Avisos / Erros</p>
            <p className="text-2xl font-bold mt-1">
              <span className="text-yellow-600">{totalAvisos}</span>
              <span className="text-muted-foreground mx-1">/</span>
              <span className="text-red-600">{totalErros}</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Alertas ativos</p>
            <p className={`text-2xl font-bold mt-1 ${alertasAtivos > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {alertasAtivos}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status por serviço */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Status dos serviços</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {loadingStatus
              ? Array.from({ length: 7 }).map((_, i) => <ServicoCardSkeleton key={i} />)
              : statusServicos.map(log => <ServicoCard key={log.id} log={log} />)
            }
            {!loadingStatus && statusServicos.length === 0 && (
              <p className="text-sm text-muted-foreground col-span-2 py-4 text-center">
                Nenhuma verificação registrada ainda. Clique em "Verificar agora" para iniciar.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Alertas */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Alertas</CardTitle>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1.5"
              onClick={() => setMostrarResolvidos(v => !v)}
            >
              {mostrarResolvidos ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
              {mostrarResolvidos ? 'Ocultar resolvidos' : 'Ver todos'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingAlertas ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : alertas.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-4 py-3">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {mostrarResolvidos ? 'Nenhum alerta registrado.' : 'Nenhum alerta ativo no momento.'}
            </div>
          ) : (
            <div>
              {alertas.map(a => (
                <AlertRow key={a.id} alerta={a} onResolver={handleResolver} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
