import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/services/api';
import { FocoRiscoAtivo } from '@/types/database';

// ─────────────────────────────────────────────────────────────────────────────
// AUX-3 — Painel SLA em tempo real
// Monitora focos_risco confirmados/em_tratamento via Realtime.
// Calcula pct_sla_consumido localmente a cada 60s sem nova query.
// ─────────────────────────────────────────────────────────────────────────────

export type SLASeveridade = 'ok' | 'atencao' | 'critico' | 'vencido';

export interface FocoSLAStatus {
  foco: FocoRiscoAtivo;
  pct_consumido: number;
  severidade: SLASeveridade;
  tempo_restante_min: number;
}

function calcPct(inicio: string | null, prazo: string | null): number {
  if (!inicio || !prazo) return 0;
  const ini   = new Date(inicio).getTime();
  const fim   = new Date(prazo).getTime();
  const agora = Date.now();
  const total = fim - ini;
  if (total <= 0) return 100;
  return Math.min(100, Math.max(0, ((agora - ini) / total) * 100));
}

function calcSeveridade(pct: number): SLASeveridade {
  if (pct >= 100) return 'vencido';
  if (pct >=  90) return 'critico';
  if (pct >=  70) return 'atencao';
  return 'ok';
}

function calcTempoRestanteMin(prazo: string | null): number {
  if (!prazo) return Infinity;
  return Math.round((new Date(prazo).getTime() - Date.now()) / 60_000);
}

function buildStatus(focos: FocoRiscoAtivo[]): FocoSLAStatus[] {
  return focos
    .map(f => {
      const pct        = calcPct(f.sla_prazo_em ? f.confirmado_em : null, f.sla_prazo_em);
      const severidade = calcSeveridade(pct);
      const tempo_restante_min = calcTempoRestanteMin(f.sla_prazo_em);
      return { foco: f, pct_consumido: pct, severidade, tempo_restante_min };
    })
    .sort((a, b) => b.pct_consumido - a.pct_consumido);
}

// ─────────────────────────────────────────────────────────────────────────────

interface Options {
  clienteId: string | null | undefined;
  enabled?: boolean;
}

export function usePainelSLA({ clienteId, enabled = true }: Options) {
  const [focosRaw, setFocosRaw]   = useState<FocoRiscoAtivo[]>([]);
  const [statuses, setStatuses]   = useState<FocoSLAStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const notifiedCritico           = useRef<Set<string>>(new Set());

  // Calcula status localmente a partir dos focos em memória
  const recalc = useCallback(() => {
    setStatuses(buildStatus(focosRaw));
  }, [focosRaw]);

  // Busca inicial + ao receber evento Realtime
  const fetch = useCallback(async () => {
    if (!clienteId || !enabled) return;
    setIsLoading(true);
    try {
      const { data } = await api.focosRisco.list(clienteId, {
        status: ['confirmado', 'em_tratamento'],
        pageSize: 200,
      });
      setFocosRaw(data);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, [clienteId, enabled]);

  // Recalc imediato quando focosRaw muda
  useEffect(() => { recalc(); }, [recalc]);

  // Re-calcula a cada 60s sem nova query (prazo_final é estático)
  useEffect(() => {
    const id = setInterval(recalc, 60_000);
    return () => clearInterval(id);
  }, [recalc]);

  // Fetch inicial
  useEffect(() => { fetch(); }, [fetch]);

  // Polling — atualiza a cada 30s
  useEffect(() => {
    if (!clienteId || !enabled) return;
    const id = setInterval(() => { fetch(); }, 30_000);
    return () => clearInterval(id);
  }, [clienteId, enabled, fetch]);

  // Rastreia focos críticos para notificações futuras (push NestJS pendente)
  useEffect(() => {
    statuses.forEach(({ foco, severidade }) => {
      if (severidade !== 'critico') {
        notifiedCritico.current.delete(foco.id);
      } else {
        notifiedCritico.current.add(foco.id);
      }
    });
  }, [statuses]);

  const counts = statuses.reduce(
    (acc, s) => { acc[s.severidade] = (acc[s.severidade] ?? 0) + 1; return acc; },
    {} as Record<SLASeveridade, number>,
  );

  return {
    statuses,
    counts,
    isLoading,
    refresh: fetch,
    /** Focos em atencao/critico/vencido ordenados por criticidade. */
    alertas: statuses.filter(s => s.severidade !== 'ok'),
  };
}
