import { FocoRisco, FocoRiscoStatus } from '../entities/foco-risco';

/** Fases configuráveis em `sla_foco_config` (mesmo conjunto de `save-foco-config.body`). */
export type SlaFaseConfig = 'triagem' | 'inspecao' | 'confirmacao' | 'tratamento';

export type FocoSlaStatus = 'ok' | 'atencao' | 'critico' | 'vencido';

export type FocoSlaSnapshotHttp = {
  statusAtual: string;
  faseSla: SlaFaseConfig | null;
  entradaEstadoAtualEm: string;
  tempoNoEstadoAtualSegundos: number;
  prazoFaseMinutos: number | null;
  percentualConsumidoFase: number | null;
  statusSla: FocoSlaStatus;
  operacional: {
    id: string;
    inicio: string;
    prazoFinal: string;
    violado: boolean;
    status: string;
    percentualConsumido: number | null;
  } | null;
};

/** Limites de alerta sobre o prazo da fase (não há coluna no banco; alinhado a SLAs típicos do produto). */
const PCT_ATENCAO = 70;
const PCT_CRITICO = 90;

const STATUS_PARA_FASE: Record<
  FocoRiscoStatus,
  SlaFaseConfig | null
> = {
  suspeita: 'triagem',
  em_triagem: 'triagem',
  aguarda_inspecao: 'triagem',
  em_inspecao: 'inspecao',
  confirmado: 'confirmacao',
  em_tratamento: 'tratamento',
  resolvido: null,
  descartado: null,
};

export function mapFocoStatusParaFaseSla(status: FocoRiscoStatus): SlaFaseConfig | null {
  return STATUS_PARA_FASE[status] ?? null;
}

/**
 * Momento em que o foco entrou no status atual, derivado do histórico (último evento com `statusNovo` = status atual).
 * Fallback: `suspeitaEm` (criação do foco).
 */
export function resolverEntradaEstadoAtual(foco: FocoRisco): Date {
  const h = foco.historico;
  if (h?.length) {
    const sorted = [...h].sort(
      (a, b) =>
        (a.alteradoEm?.getTime() ?? 0) - (b.alteradoEm?.getTime() ?? 0),
    );
    for (let i = sorted.length - 1; i >= 0; i--) {
      const e = sorted[i];
      if (e.statusNovo === foco.status && e.alteradoEm) {
        return e.alteradoEm;
      }
    }
  }
  return foco.suspeitaEm;
}

function classificarPorPercentual(pct: number): FocoSlaStatus {
  if (pct >= 100) return 'vencido';
  if (pct >= PCT_CRITICO) return 'critico';
  if (pct >= PCT_ATENCAO) return 'atencao';
  return 'ok';
}

type SlaOpInput = {
  id: string;
  inicio: Date;
  prazo_final: Date;
  violado: boolean;
  status: string;
} | null;

export function buildFocoSlaSnapshot(input: {
  foco: FocoRisco;
  agora: Date;
  prazoFaseMinutos: number | null;
  slaOperacional: SlaOpInput;
}): FocoSlaSnapshotHttp {
  const { foco, agora, prazoFaseMinutos, slaOperacional } = input;
  const faseSla = mapFocoStatusParaFaseSla(foco.status);
  const entrada = resolverEntradaEstadoAtual(foco);
  const tempoMs = Math.max(0, agora.getTime() - entrada.getTime());
  const tempoNoEstadoAtualSegundos = Math.floor(tempoMs / 1000);

  let percentualFase: number | null = null;
  if (prazoFaseMinutos != null && prazoFaseMinutos > 0) {
    const decorridoMin = tempoMs / 60_000;
    percentualFase = (decorridoMin / prazoFaseMinutos) * 100;
  }

  let operacional: FocoSlaSnapshotHttp['operacional'] = null;
  let pctGlobal: number | null = null;
  if (slaOperacional) {
    const { inicio, prazo_final } = slaOperacional;
    const total = prazo_final.getTime() - inicio.getTime();
    if (total > 0) {
      pctGlobal = Math.min(
        100,
        Math.max(0, ((agora.getTime() - inicio.getTime()) / total) * 100),
      );
    }
    operacional = {
      id: slaOperacional.id,
      inicio: inicio.toISOString(),
      prazoFinal: prazo_final.toISOString(),
      violado: slaOperacional.violado,
      status: slaOperacional.status,
      percentualConsumido: pctGlobal,
    };
  }

  let statusSla: FocoSlaStatus = 'ok';

  if (slaOperacional) {
    if (slaOperacional.violado || agora.getTime() > slaOperacional.prazo_final.getTime()) {
      statusSla = 'vencido';
    } else if (percentualFase != null) {
      statusSla = classificarPorPercentual(percentualFase);
    } else if (pctGlobal != null) {
      statusSla = classificarPorPercentual(pctGlobal);
    }
  } else if (percentualFase != null) {
    statusSla = classificarPorPercentual(percentualFase);
  }

  return {
    statusAtual: foco.status,
    faseSla,
    entradaEstadoAtualEm: entrada.toISOString(),
    tempoNoEstadoAtualSegundos,
    prazoFaseMinutos,
    percentualConsumidoFase: percentualFase != null ? Math.round(percentualFase * 100) / 100 : null,
    statusSla,
    operacional,
  };
}
