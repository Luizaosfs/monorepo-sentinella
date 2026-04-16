// Re-export types from database.ts to avoid duplication
export type {
  FocoRisco,
  FocoRiscoAtivo,
  FocoRiscoHistorico,
  FocoRiscoTimelineItem,
  FocoRiscoStatus,
  FocoRiscoFiltros,
  FocoRiscoPrioridade,
} from '@/types/database';

export type SlaStatus = 'ok' | 'atencao' | 'critico' | 'vencido' | 'sem_sla';

// Enum for convenient usage in switch statements and component props
export enum FocoRiscoStatusEnum {
  SUSPEITA = 'suspeita',
  EM_TRIAGEM = 'em_triagem',
  AGUARDA_INSPECAO = 'aguarda_inspecao',
  EM_INSPECAO = 'em_inspecao',
  CONFIRMADO = 'confirmado',
  EM_TRATAMENTO = 'em_tratamento',
  RESOLVIDO = 'resolvido',
  DESCARTADO = 'descartado',
}

export enum FocoRiscoOrigem {
  DRONE = 'drone',
  AGENTE = 'agente',
  CIDADAO = 'cidadao',
  PLUVIO = 'pluvio',
  MANUAL = 'manual',
}

// Color maps
export const COR_STATUS: Record<string, string> = {
  suspeita:         '#378ADD',
  em_triagem:       '#BA7517',
  aguarda_inspecao: '#EF9F27',
  em_inspecao:      '#2563EB',
  confirmado:       '#D85A30',
  em_tratamento:    '#993C1D',
  resolvido:        '#3B6D11',
  descartado:       '#888780',
};

export const COR_SLA: Record<string, string> = {
  ok:      '#3B6D11',
  atencao: '#BA7517',
  critico: '#D85A30',
  vencido: '#E24B4A',
  sem_sla: '#888780',
};

export const LABEL_STATUS: Record<string, string> = {
  suspeita:         'Suspeita',
  em_triagem:       'Em triagem',
  aguarda_inspecao: 'Aguarda inspeção',
  em_inspecao:      'Em inspeção',
  confirmado:       'Confirmado',
  em_tratamento:    'Em tratamento',
  resolvido:        'Resolvido',
  descartado:       'Descartado',
};

export const LABEL_SLA: Record<string, string> = {
  ok:      'OK',
  atencao: 'Atenção',
  critico: 'Crítico',
  vencido: 'Vencido',
  sem_sla: 'Sem SLA',
};

export const LABEL_ORIGEM: Record<string, string> = {
  drone:   'Drone',
  agente:  'Agente',
  cidadao: 'Cidadão',
  pluvio:  'Pluvial',
  manual:  'Manual',
};
