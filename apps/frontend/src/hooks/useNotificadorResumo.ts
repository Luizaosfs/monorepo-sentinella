import { useMemo } from 'react';
import { useCasosNotificados } from '@/hooks/queries/useCasosNotificados';
import type { CasoNotificado } from '@/types/database';

function semanaEpidemiologica(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - start.getTime();
  return Math.ceil((diff / 86400000 + start.getDay() + 1) / 7);
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000);
}

function formatDate(d: Date) {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export interface NotificadorResumo {
  isLoading: boolean;
  meusCasosTodos: CasoNotificado[];
  totalSemana: number;
  suspeitos: number;
  confirmados: number;
  descartados: number;
  pieData: { doenca: string; value: number }[];
  barData: { label: string; date: Date; total: number }[];
  semanaEpidemiologicaAtual: number;
}

/**
 * Deriva os KPIs/gráficos da home do notificador a partir de `casos_notificados`.
 *
 * Lógica de negócio fica aqui (regra do CLAUDE.md: lógica em hooks, não em páginas).
 * A página apenas consome o resultado e compõe a UI.
 */
export function useNotificadorResumo(
  clienteId: string | null | undefined,
  usuarioId: string | null | undefined,
): NotificadorResumo {
  const { data: todos = [], isLoading } = useCasosNotificados(clienteId);

  const corte30 = useMemo(() => daysAgo(30), []);

  const casos30 = useMemo(
    () => todos.filter((c) => new Date(c.created_at) >= corte30),
    [todos, corte30],
  );

  const meusCasosTodos = useMemo(
    () => casos30.filter((c) => c.notificador_id === usuarioId || !c.notificador_id),
    [casos30, usuarioId],
  );

  const totalSemana = useMemo(() => {
    const corte7 = daysAgo(7);
    return todos.filter((c) => new Date(c.created_at) >= corte7).length;
  }, [todos]);

  const confirmados = useMemo(
    () => casos30.filter((c) => c.status === 'confirmado').length,
    [casos30],
  );
  const suspeitos = useMemo(
    () => casos30.filter((c) => c.status === 'suspeito').length,
    [casos30],
  );
  const descartados = useMemo(
    () => casos30.filter((c) => c.status === 'descartado').length,
    [casos30],
  );

  const pieData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of casos30) counts[c.doenca] = (counts[c.doenca] || 0) + 1;
    return Object.entries(counts).map(([doenca, value]) => ({ doenca, value }));
  }, [casos30]);

  const barData = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = daysAgo(13 - i);
      return { label: formatDate(d), date: d, total: 0 };
    });
    for (const c of todos) {
      const d = new Date(c.created_at);
      const idx = days.findIndex(
        (day) => day.date.getDate() === d.getDate() && day.date.getMonth() === d.getMonth(),
      );
      if (idx >= 0) days[idx].total++;
    }
    return days;
  }, [todos]);

  return {
    isLoading,
    meusCasosTodos,
    totalSemana,
    suspeitos,
    confirmados,
    descartados,
    pieData,
    barData,
    semanaEpidemiologicaAtual: semanaEpidemiologica(new Date()),
  };
}
