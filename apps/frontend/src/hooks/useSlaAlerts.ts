import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { api } from '@/services/api';
import { SlaOperacional, getSlaVisualStatus, getSlaLocalLabel, getTempoRestante } from '@/types/sla';
import { toast } from 'sonner';
import { sendBrowserNotification } from '@/hooks/useNotificationPermission';
import { subscribeUserToPush } from '@/lib/webPush';
import { useRealtimeInvalidator } from '@/hooks/useRealtimeInvalidator';

const POLL_INTERVAL = 60_000; // 1 minuto

/**
 * Sonner usa flushSync; vários toasts em sequência (ou logo após setState vindo do mesmo tick que useEffect)
 * disparam "Maximum update depth". Adiamos para depois do paint e espaçamos cada toast.
 */
function scheduleSlaToasts(fns: Array<() => void>) {
  if (fns.length === 0) return;
  const run = () => {
    fns.forEach((fn, i) => {
      window.setTimeout(fn, i * 100);
    });
  };
  requestAnimationFrame(() => {
    requestAnimationFrame(run);
  });
}

interface UseSlaAlertsOptions {
  clienteId: string | null;
  usuarioId?: string | null;
  enabled?: boolean;
}

function sameUrgentList(prev: SlaOperacional[], next: SlaOperacional[]): boolean {
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i++) {
    if (prev[i]?.id !== next[i]?.id) return false;
  }
  return true;
}

export function useSlaAlerts({ clienteId, usuarioId, enabled = true }: UseSlaAlertsOptions) {
  const [urgentCount, setUrgentCount] = useState(0);
  const [urgentSlas, setUrgentSlas] = useState<SlaOperacional[]>([]);
  const notifiedRef = useRef<Set<string>>(new Set());
  const lastPollClienteRef = useRef<string | null>(null);
  const clienteEnabledRef = useRef({ clienteId, enabled });
  clienteEnabledRef.current = { clienteId, enabled };

  const check = useCallback(async () => {
    const { clienteId: cid, enabled: en } = clienteEnabledRef.current;
    if (!cid || !en) return;

    try {
      // Marca SLAs expirados como 'vencido' antes de buscar (silencioso)
      await api.sla.verificarVencidos(cid).catch(() => undefined);

      const { data, error } = await supabase
        .from('sla_operacional')
        .select(`
          *,
          item:pluvio_operacional_item(id, bairro_nome, prioridade_operacional, run_id,
            run:pluvio_operacional_run(id, cliente_id)
          ),
          levantamento_item:levantamento_itens(id, item, prioridade, endereco_curto,
            levantamento:levantamentos(id, cliente_id)
          )
        `)
        .eq('cliente_id', cid)
        .in('status', ['pendente', 'em_atendimento'])
        .order('prazo_final', { ascending: true });

      if (error) throw error;

      const filtered = (data || []) as SlaOperacional[];

      // Find warning + expired + escalated SLAs
      const urgent = filtered.filter(s => {
        const visual = getSlaVisualStatus(s);
        return visual === 'warning' || visual === 'expired' || s.escalonado;
      });

      setUrgentCount((prev) => (prev === urgent.length ? prev : urgent.length));
      setUrgentSlas((prev) => (sameUrgentList(prev, urgent) ? prev : urgent));

      const toasts: Array<() => void> = [];

      // Toast for newly urgent SLAs (not previously notified)
      urgent.forEach(s => {
        if (!notifiedRef.current.has(s.id)) {
          notifiedRef.current.add(s.id);
          const visual = getSlaVisualStatus(s);
          const bairro = getSlaLocalLabel(s);
          const restante = getTempoRestante(s.prazo_final);

          if (s.escalonado && !notifiedRef.current.has(`esc_${s.id}`)) {
            notifiedRef.current.add(`esc_${s.id}`);
            const desc = `Prioridade elevada para ${s.prioridade} (era ${s.prioridade_original || '?'})`;
            toasts.push(() => {
              toast.error(`🔺 SLA Escalonado: ${bairro}`, {
                description: desc,
                duration: 10000,
              });
              sendBrowserNotification(`🔺 SLA Escalonado: ${bairro}`, {
                body: desc,
                tag: `sla-esc-${s.id}`,
              });
            });
          } else if (visual === 'expired') {
            const desc = `Prioridade ${s.prioridade} — prazo expirado`;
            toasts.push(() => {
              toast.error(`⏰ SLA Vencido: ${bairro}`, {
                description: desc,
                duration: 8000,
              });
              sendBrowserNotification(`⏰ SLA Vencido: ${bairro}`, {
                body: desc,
                tag: `sla-exp-${s.id}`,
              });
            });
          } else if (visual === 'warning') {
            const desc = `Prioridade ${s.prioridade} — ${restante} restante`;
            toasts.push(() => {
              toast.warning(`⚠️ SLA Próximo do Vencimento: ${bairro}`, {
                description: desc,
                duration: 6000,
              });
              sendBrowserNotification(`⚠️ SLA Prestes a Vencer: ${bairro}`, {
                body: desc,
                tag: `sla-warn-${s.id}`,
              });
            });
          }
        }
      });

      // Cleanup notified set (remove resolved)
      const urgentIds = new Set(urgent.map(s => s.id));
      notifiedRef.current.forEach(id => {
        if (!urgentIds.has(id)) notifiedRef.current.delete(id);
      });

      if (toasts.length > 0) {
        scheduleSlaToasts(toasts);
      }
    } catch {
      // Silent fail on polling
    }
  }, []);

  useEffect(() => {
    if (!clienteId || !enabled) {
      setUrgentCount((c) => (c === 0 ? c : 0));
      setUrgentSlas((prev) => (prev.length === 0 ? prev : []));
      notifiedRef.current.clear();
      lastPollClienteRef.current = null;
      return;
    }
    if (lastPollClienteRef.current !== clienteId) {
      notifiedRef.current.clear();
      lastPollClienteRef.current = clienteId;
    }
    void check();
    const interval = setInterval(() => void check(), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [clienteId, enabled, check]);

  // Assina Web Push quando usuário e cliente estiverem disponíveis
  // QW-09 Correção 4c: exibe toast se a assinatura anterior foi removida pelo servidor
  useEffect(() => {
    if (!clienteId || !usuarioId || !enabled) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    subscribeUserToPush(usuarioId, clienteId).then((resubscribed) => {
      if (resubscribed) {
        scheduleSlaToasts([
          () =>
            toast.warning('Alertas push reativados', {
              description:
                'Sua assinatura de notificações de SLA havia sido removida e foi restaurada automaticamente.',
              duration: 8000,
            }),
        ]);
      }
    }).catch(() => undefined);
  }, [clienteId, usuarioId, enabled]);

  // Realtime: invalida queries de SLA ao receber mudanças no banco
  useRealtimeInvalidator({
    table: 'sla_operacional',
    filter: clienteId ? `cliente_id=eq.${clienteId}` : undefined,
    queryKeys: [['sla', clienteId], ['sla_pending_count', clienteId]],
    enabled: !!clienteId && enabled,
  });

  return { urgentCount, urgentSlas, refresh: check };
}
