import { Bell, BellRing } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useSlaAlerts } from '@/hooks/useSlaAlerts';
import { getSlaVisualStatus, getSlaLocalLabel, getTempoRestante } from '@/types/sla';
import { useNavigate } from 'react-router-dom';
import { useNotificationPermission } from '@/hooks/useNotificationPermission';

interface Props {
  clienteId: string | null;
}

const visualEmoji: Record<string, string> = { ok: '🟢', warning: '🟡', expired: '🔴' };

export function SlaAlertBell({ clienteId }: Props) {
  const { urgentCount, urgentSlas } = useSlaAlerts({ clienteId });
  const navigate = useNavigate();
  const { permission, supported, requestPermission } = useNotificationPermission();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'relative h-9 w-9 rounded-xl transition-all',
            urgentCount > 0 && 'text-warning hover:text-warning'
          )}
        >
          <Bell className={cn('h-4 w-4', urgentCount > 0 && 'animate-pulse')} />
          {urgentCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground px-1 shadow-lg">
              {urgentCount > 9 ? '9+' : urgentCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0" sideOffset={8}>
        <div className="px-4 py-3 border-b border-border/40">
          <p className="text-sm font-bold">Alertas de SLA</p>
          <p className="text-[10px] text-muted-foreground">
            {urgentCount > 0
              ? `${urgentCount} item(ns) requer(em) atenção`
              : 'Nenhum alerta no momento'}
          </p>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {urgentSlas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="w-6 h-6 mb-2 opacity-30" />
              <p className="text-xs">Todos os SLAs dentro do prazo</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {urgentSlas.slice(0, 8).map(sla => {
                const visual = getSlaVisualStatus(sla);
                return (
                  <button
                    key={sla.id}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/40 transition-colors',
                      visual === 'expired' && 'bg-destructive/5'
                    )}
                    onClick={() => {
                      if (sla.levantamento_item_id) {
                        navigate(`/agente/levantamentos?item=${sla.levantamento_item_id}`);
                      } else {
                        navigate('/agente/hoje');
                      }
                    }}
                  >
                    <span className="text-sm shrink-0">{visualEmoji[visual]}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate flex items-center gap-1">
                        {sla.escalonado && <span className="text-[9px] text-destructive font-bold">🔺 ESC</span>}
                        {getSlaLocalLabel(sla)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{sla.prioridade} · SLA {sla.sla_horas}h</p>
                    </div>
                    <span className={cn(
                      'text-[10px] font-bold shrink-0',
                      visual === 'expired' ? 'text-destructive' : 'text-warning'
                    )}>
                      {getTempoRestante(sla.prazo_final)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {/* Notification permission banner */}
        {supported && permission !== 'granted' && (
          <div className="px-4 py-2.5 border-t border-border/40 bg-accent/30">
            <button
              className="flex items-center gap-2 text-[11px] font-semibold text-primary hover:underline w-full justify-center"
              onClick={requestPermission}
            >
              <BellRing className="w-3.5 h-3.5" />
              Ativar notificações push
            </button>
            <p className="text-[9px] text-muted-foreground text-center mt-0.5">
              Receba alertas mesmo com a aba em segundo plano
            </p>
          </div>
        )}
        {supported && permission === 'granted' && (
          <div className="px-3 py-1.5 border-t border-border/40 bg-muted/20">
            <p className="text-[9px] text-muted-foreground text-center flex items-center gap-1 justify-center">
              <BellRing className="w-3 h-3" /> Notificações push ativas
            </p>
          </div>
        )}
        {urgentCount > 0 && (
          <div className="px-4 py-2.5 border-t border-border/40 bg-muted/20">
            <button
              className="text-[11px] font-bold text-primary hover:underline w-full text-center"
              onClick={() => navigate('/gestor/sla')}
            >
              Ver gestão completa →
            </button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
