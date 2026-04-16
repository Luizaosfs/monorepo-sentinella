// Per-client SLA configuration types

export interface SlaPrioridadeConfig {
  horas: number;
  criticidade: string;
}

export interface SlaFatoresConfig {
  risco_muito_alto_pct: number;     // e.g. 30 means 30% reduction
  persistencia_dias_min: number;    // threshold days
  persistencia_pct: number;         // e.g. 20 means 20% reduction
  temperatura_min: number;          // threshold °C
  temperatura_pct: number;          // e.g. 10 means 10% reduction
}

export interface SlaHorarioComercial {
  ativo: boolean;
  inicio: string;   // "08:00"
  fim: string;      // "18:00"
  dias_semana: number[];  // 0=Dom, 1=Seg ... 6=Sab
}

export interface SlaConfigJson {
  prioridades: Record<string, SlaPrioridadeConfig>;
  fatores: SlaFatoresConfig;
  horario_comercial: SlaHorarioComercial;
}

export interface SlaConfigRow {
  id: string;
  cliente_id: string;
  config: SlaConfigJson;
  created_at: string;
  updated_at: string;
}

// Default config matching current hardcoded SLA_RULES
export const DEFAULT_SLA_CONFIG: SlaConfigJson = {
  prioridades: {
    'Crítica':        { horas: 4,  criticidade: 'Muito Alta' },
    'Urgente':        { horas: 4,  criticidade: 'Muito Alta' },
    'Alta':           { horas: 12, criticidade: 'Alta' },
    'Moderada':       { horas: 24, criticidade: 'Média' },
    'Média':          { horas: 24, criticidade: 'Média' },
    'Baixa':          { horas: 72, criticidade: 'Baixa' },
    'Monitoramento':  { horas: 72, criticidade: 'Baixa' },
  },
  fatores: {
    risco_muito_alto_pct: 30,
    persistencia_dias_min: 3,
    persistencia_pct: 20,
    temperatura_min: 30,
    temperatura_pct: 10,
  },
  horario_comercial: {
    ativo: false,
    inicio: '08:00',
    fim: '18:00',
    dias_semana: [1, 2, 3, 4, 5],
  },
};
