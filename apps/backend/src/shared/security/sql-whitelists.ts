import { BadRequestException } from '@nestjs/common';

// ─── Focos de risco ───────────────────────────────────────────────────────────

export const FOCO_STATUS_PERMITIDOS = [
  'suspeita',
  'em_triagem',
  'aguarda_inspecao',
  'em_inspecao',
  'aguardando_nova_tentativa',
  'confirmado',
  'em_tratamento',
  'resolvido',
  'descartado',
] as const;
export type FocoStatusPermitido = (typeof FOCO_STATUS_PERMITIDOS)[number];
const FOCO_STATUS_SET = new Set<string>(FOCO_STATUS_PERMITIDOS);

export const PRIORIDADE_PERMITIDA = ['P1', 'P2', 'P3', 'P4', 'P5'] as const;
export type PrioridadePermitida = (typeof PRIORIDADE_PERMITIDA)[number];
const PRIORIDADE_SET = new Set<string>(PRIORIDADE_PERMITIDA);

// ─── Operações ────────────────────────────────────────────────────────────────

export const OPERACAO_STATUS_PERMITIDOS = [
  'pendente',
  'em_andamento',
  'concluido',
  'cancelado',
] as const;
export type OperacaoStatusPermitido = (typeof OPERACAO_STATUS_PERMITIDOS)[number];
const OPERACAO_STATUS_SET = new Set<string>(OPERACAO_STATUS_PERMITIDOS);

export const TIPO_VINCULO_PERMITIDOS = [
  'operacional',
  'levantamento',
  'regiao',
] as const;
export type TipoVinculoPermitido = (typeof TIPO_VINCULO_PERMITIDOS)[number];
const TIPO_VINCULO_SET = new Set<string>(TIPO_VINCULO_PERMITIDOS);

// ─── Vistorias ────────────────────────────────────────────────────────────────

// Prioridade de vistoria consolidada usa mesmo enum P1-P5 que foco
export const PRIORIDADE_VISTORIA_PERMITIDA = PRIORIDADE_PERMITIDA;
const PRIORIDADE_VISTORIA_SET = PRIORIDADE_SET;

// ─── Histórico de eventos ─────────────────────────────────────────────────────

export const TIPO_EVENTO_PERMITIDOS = [
  'transicao_status',
  'classificacao_alterada',
  'dados_minimos_completos',
  'inspecao_iniciada',
  'atribuicao_responsavel',
  'mudanca_status',
  'criacao',
  'reinspecao_realizada',
  'reinspecao_agendada',
  'sem_acesso_registrado',
  'escalado_supervisor',
  'retorno_planejado',
] as const;
export type TipoEventoPermitido = (typeof TIPO_EVENTO_PERMITIDOS)[number];

// ─── Helpers de validação ─────────────────────────────────────────────────────

export function assertFocoStatus(values: string[]): FocoStatusPermitido[] {
  const invalid = values.filter((v) => !FOCO_STATUS_SET.has(v));
  if (invalid.length) {
    throw new BadRequestException(`Status inválido(s): ${invalid.join(', ')}`);
  }
  return values as FocoStatusPermitido[];
}

export function assertPrioridade(values: string[]): PrioridadePermitida[] {
  const invalid = values.filter((v) => !PRIORIDADE_SET.has(v));
  if (invalid.length) {
    throw new BadRequestException(`Prioridade inválida(s): ${invalid.join(', ')}`);
  }
  return values as PrioridadePermitida[];
}

export function assertOperacaoStatus(value: string): OperacaoStatusPermitido {
  if (!OPERACAO_STATUS_SET.has(value)) {
    throw new BadRequestException(`Status de operação inválido: ${value}`);
  }
  return value as OperacaoStatusPermitido;
}

export function assertTipoVinculo(value: string): TipoVinculoPermitido {
  if (!TIPO_VINCULO_SET.has(value)) {
    throw new BadRequestException(`Tipo de vínculo inválido: ${value}`);
  }
  return value as TipoVinculoPermitido;
}

export function assertPrioridadeVistoria(values: string[]): string[] {
  const invalid = values.filter((v) => !PRIORIDADE_VISTORIA_SET.has(v));
  if (invalid.length) {
    throw new BadRequestException(`Prioridade de vistoria inválida(s): ${invalid.join(', ')}`);
  }
  return values;
}
