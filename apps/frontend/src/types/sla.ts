// SLA Operacional Types

/** Mapeamento canônico de código P1–P5 para rótulo em português (REGRAS DE NEGÓCIO v1.0). */
export const PRIORIDADE_MAP: Record<string, string> = {
  P1: 'Crítico',
  P2: 'Alta',
  P3: 'Média',
  P4: 'Baixa',
  P5: 'Monitoramento',
} as const;

export type SlaStatus = 'pendente' | 'em_atendimento' | 'concluido' | 'vencido';

export interface SlaOperacional {
  id: string;
  item_id: string | null;
  levantamento_item_id: string | null;
  cliente_id: string | null;
  agente_id: string | null;
  prioridade: string;
  sla_horas: number;
  inicio: string;
  prazo_final: string;
  concluido_em: string | null;
  status: SlaStatus;
  violado: boolean;
  escalonado: boolean;
  escalonado_em: string | null;
  escalado_por: string | null;
  reaberto_por: string | null;
  prioridade_original: string | null;
  created_at: string;
  // joined — pluvio
  item?: {
    id: string;
    bairro_nome: string;
    classificacao_risco: string;
    situacao_ambiental: string | null;
    chuva_24h_mm: number | null;
    tendencia: string | null;
    prioridade_operacional: string;
    run_id: string;
    run?: {
      id: string;
      dt_ref: string;
      cliente_id: string;
    };
  } | null;
  // joined — levantamento
  levantamento_item?: {
    id: string;
    item: string | null;
    risco: string | null;
    prioridade: string | null;
    endereco_curto: string | null;
    levantamento?: {
      id: string;
      cliente_id: string;
    };
  } | null;
  agente?: {
    id: string;
    nome: string;
    email: string;
  };
}

/** Retorna uma label de localização legível para qualquer tipo de SLA. */
export function getSlaLocalLabel(sla: SlaOperacional): string {
  if (sla.item?.bairro_nome) return sla.item.bairro_nome;
  if (sla.levantamento_item?.endereco_curto) return sla.levantamento_item.endereco_curto;
  if (sla.levantamento_item?.item) return sla.levantamento_item.item;
  return '—';
}

/** Origem do SLA: 'pluvio' | 'levantamento' */
export function getSlaOrigem(sla: SlaOperacional): 'pluvio' | 'levantamento' {
  return sla.levantamento_item_id ? 'levantamento' : 'pluvio';
}

import type { SlaConfigJson } from './sla-config';
import { DEFAULT_SLA_CONFIG } from './sla-config';

// SLA calculation rules
export const SLA_RULES: Record<string, { horas: number; criticidade: string }> = {
  Crítica: { horas: 4, criticidade: 'Muito Alta' },
  Urgente: { horas: 4, criticidade: 'Muito Alta' },
  Alta: { horas: 12, criticidade: 'Alta' },
  Moderada: { horas: 24, criticidade: 'Média' },
  Média: { horas: 24, criticidade: 'Média' },
  Baixa: { horas: 72, criticidade: 'Baixa' },
  Monitoramento: { horas: 72, criticidade: 'Baixa' },
};

/**
 * @deprecated Use `sla.prazo_final` (campo da tabela `sla_operacional`).
 *
 * Esta função é APENAS para simulação visual em formulários de configuração.
 * O SLA canônico é calculado pelo banco via `sla_calcular_prazo_final()`,
 * que aplica feriados, horário comercial e configuração por região.
 *
 * NUNCA use para: comparar prazos, decidir vencimento, lógica de negócio.
 *
 * ATENÇÃO — uso restrito a simulação visual no frontend.
 *
 * O SLA oficial é calculado e persistido pelo banco de dados:
 *   - prazo_final em sla_operacional é a fonte canônica
 *   - Triggers: trg_levantamento_item_criar_sla_auto, trg_after_insert_pluvio_item_sla
 *   - Feriados e horário comercial são aplicados pelo banco via sla_calcular_prazo_final()
 *
 * Esta função existe apenas para:
 *   - Estimar o impacto de uma mudança de prioridade antes de salvar
 *   - Exibir valores simulados em formulários de configuração
 *
 * Nunca use este resultado como prazo real, para comparação com o banco
 * ou para decidir lógica de negócio.
 */
export function calcularSlaHoras(
  prioridade: string,
  classificacaoRisco?: string | null,
  persistencia7d?: string | null,
  tempMediaC?: number | null,
  config?: SlaConfigJson,
): number {
  const cfg = config ?? DEFAULT_SLA_CONFIG;
  const rule = cfg.prioridades[prioridade] ?? cfg.prioridades['Baixa'] ?? { horas: 72 };
  let horas = rule.horas;
  const fatores = cfg.fatores;

  // Se classificação de risco "Muito Alto" → reduzir conforme config
  if (classificacaoRisco && classificacaoRisco.toLowerCase() === 'muito alto') {
    horas *= (1 - fatores.risco_muito_alto_pct / 100);
  }

  // Se persistência > limiar → reduzir conforme config
  const persNum = persistencia7d ? parseInt(persistencia7d, 10) : 0;
  if (!isNaN(persNum) && persNum > fatores.persistencia_dias_min) {
    horas *= (1 - fatores.persistencia_pct / 100);
  }

  // Se temperatura > limiar → reduzir conforme config
  if (tempMediaC != null && tempMediaC > fatores.temperatura_min) {
    horas *= (1 - fatores.temperatura_pct / 100);
  }

  // Mínimo 2 horas
  return Math.max(2, Math.round(horas));
}

/**
 * Detecta se o SLA foi reduzido por condições climáticas comparando o prazo
 * efetivo (sla_prazo_em - confirmado_em) com o prazo base da prioridade.
 *
 * Retorna uma string descritiva se houver redução (> 5% abaixo do base),
 * ou null se não houver redução detectável.
 *
 * Tolerância de 5% para absorver arredondamentos e feriados.
 */
export function getSlaReductionReason(
  prioridade: string | null | undefined,
  sla_prazo_em: string | null | undefined,
  confirmado_em: string | null | undefined,
): string | null {
  if (!prioridade || !sla_prazo_em || !confirmado_em) return null;
  const rule = SLA_RULES[prioridade];
  if (!rule) return null;
  const baseHoras = rule.horas;
  const inicio = new Date(confirmado_em).getTime();
  const prazo = new Date(sla_prazo_em).getTime();
  const aplicadoHoras = (prazo - inicio) / (1000 * 60 * 60);
  // Só exibe se prazo aplicado for pelo menos 5% menor que o base
  if (aplicadoHoras >= baseHoras * 0.95) return null;
  return `SLA reduzido por condições climáticas. Prazo base: ${baseHoras}h, prazo aplicado: ${Math.round(aplicadoHoras)}h.`;
}

export function getSlaVisualStatus(sla: SlaOperacional): 'ok' | 'warning' | 'expired' {
  if (sla.status === 'vencido' || sla.violado) return 'expired';
  if (sla.status === 'concluido') return 'ok';

  const now = new Date().getTime();
  const inicio = new Date(sla.inicio).getTime();
  const prazo = new Date(sla.prazo_final).getTime();
  const totalDuration = prazo - inicio;
  const remaining = prazo - now;

  if (remaining <= 0) return 'expired';
  if (remaining < totalDuration * 0.2) return 'warning';
  return 'ok';
}

export function getTempoRestante(prazoFinal: string): string {
  const now = new Date().getTime();
  const prazo = new Date(prazoFinal).getTime();
  const diff = prazo - now;

  if (diff <= 0) return 'Vencido';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  }

  return `${hours}h ${minutes}min`;
}
