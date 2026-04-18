import { http } from '@sentinella/api-client';

/**
 * Configuração padrão de scoring de risco para drones.
 * Espelha os defaults do módulo Python (sentinela_drone_risk_config).
 */
const DEFAULT_DRONE_RISK_CONFIG = {
  /** Pontuação base por nível de risco do item detectado */
  base_by_risco: { baixo: 10, medio: 40, alto: 80 },
  /** Limites de score final para determinar a prioridade (P1 = mais urgente) */
  priority_thresholds: { P1: 80, P2: 60, P3: 40, P4: 20, P5: 0 },
  /** SLA em horas por prioridade (usado pelo drone ao gerar levantamento_itens) */
  sla_by_priority_hours: { P1: 4, P2: 12, P3: 24, P4: 48, P5: 72 },
  /** Multiplicador de confiança aplicado ao score YOLO */
  confidence_multiplier: 1.0,
  /** Overrides por item_key (ex.: forçar prioridade ou score mínimo) */
  item_overrides: {} as Record<string, { min_score?: number; force_priority?: string }>,
};

/**
 * Classes YOLO padrão para detecção de criadouros de dengue.
 * Espelha sentinela_yolo_class_config do Python.
 */
const DEFAULT_YOLO_CLASSES = [
  { item_key: 'pneu',         item: 'Pneu',                    risco: 'medio', peso: 60, acao: 'Coletar e descartar adequadamente',     is_active: true },
  { item_key: 'recipiente',   item: 'Recipiente com água',      risco: 'medio', peso: 50, acao: 'Eliminar água acumulada',               is_active: true },
  {
    item_key: 'piscina_suja',
    item: 'Piscina suja',
    risco: 'alto',
    peso: 90,
    acao: 'Vistoria imediata | Tratamento da água | Limpeza | Orientar responsável',
    is_active: true,
  },
  {
    item_key: 'piscina_limpa',
    item: 'Piscina limpa',
    risco: 'baixo',
    peso: 15,
    acao: 'Sem foco típico (água limpa/tratada) | Manter cloração e limpeza | Registrar para auditoria',
    is_active: true,
  },
  { item_key: 'caixa_dagua',  item: "Caixa d'água aberta",     risco: 'alto',  peso: 75, acao: 'Tampar ou aplicar larvicida',           is_active: true },
  {
    item_key: 'caixa_dagua_fechada',
    item: "Caixa d'água fechada",
    risco: 'baixo',
    peso: 15,
    acao: "Sem foco típico (reservatório vedado) | Registrar para auditoria | Reclassificar se houver indício de brechas",
    is_active: true,
  },
  { item_key: 'lixo',         item: 'Lixo ou entulho',          risco: 'baixo', peso: 30, acao: 'Remover entulho e materiais acumulados', is_active: true },
  { item_key: 'poca',         item: 'Poça de água',             risco: 'medio', peso: 45, acao: 'Drenagem local',                       is_active: true },
  { item_key: 'calha',        item: 'Calha entupida',           risco: 'medio', peso: 50, acao: 'Limpar calha e verificar escoamento',   is_active: true },
  { item_key: 'vaso_planta',  item: 'Vaso de planta',           risco: 'baixo', peso: 25, acao: 'Verificar acúmulo de água no prato',   is_active: true },
  { item_key: 'tampa',        item: 'Tampa ou recipiente aberto', risco: 'medio', peso: 40, acao: 'Tampar ou eliminar',                 is_active: true },
  { item_key: 'barril',       item: 'Barril ou tonel',           risco: 'alto',  peso: 70, acao: 'Tampar hermeticamente ou esvaziar',   is_active: true },
];

/**
 * Sinônimos YOLO padrão (mapeamento de labels alternativos para item_key canônico).
 */
const DEFAULT_YOLO_SYNONYMS = [
  { synonym: 'tire',          maps_to: 'pneu' },
  { synonym: 'tyre',          maps_to: 'pneu' },
  { synonym: 'pool',          maps_to: 'piscina_suja' },
  { synonym: 'water_pool',    maps_to: 'poca' },
  { synonym: 'puddle',        maps_to: 'poca' },
  { synonym: 'container',     maps_to: 'recipiente' },
  { synonym: 'bottle',        maps_to: 'recipiente' },
  { synonym: 'bucket',        maps_to: 'recipiente' },
  { synonym: 'tank',          maps_to: 'caixa_dagua' },
  { synonym: 'water_tank',    maps_to: 'caixa_dagua' },
  { synonym: 'barrel',        maps_to: 'barril' },
  { synonym: 'trash',         maps_to: 'lixo' },
  { synonym: 'garbage',       maps_to: 'lixo' },
  { synonym: 'debris',        maps_to: 'lixo' },
  { synonym: 'gutter',        maps_to: 'calha' },
  { synonym: 'flowerpot',     maps_to: 'vaso_planta' },
  { synonym: 'plant_pot',     maps_to: 'vaso_planta' },
  // Labels PT do pipeline YOLO (alvos canônicos sem classe dedicada → mapeamento mais próximo)
  { synonym: 'caixa_agua',         maps_to: 'caixa_dagua' },
  { synonym: 'caixa_agua_aberta',  maps_to: 'caixa_dagua' },
  { synonym: 'pneu_velho',         maps_to: 'pneu' },
  { synonym: 'piscina_verde',      maps_to: 'piscina_suja' },
  { synonym: 'agua_parada',        maps_to: 'poca' },
];

/**
 * Cria a configuração padrão de risco para drones de um cliente recém-criado.
 * Silenciosamente ignora erros para não bloquear o fluxo de criação do cliente.
 *
 * Tabelas populadas:
 * - sentinela_drone_risk_config   (1 linha)
 * - sentinela_yolo_class_config   (N classes padrão)
 * - sentinela_yolo_synonym        (N sinônimos padrão)
 * - plano_acao_catalogo           (ações por tipo, espelho do YOLO config)
 */
export async function seedDefaultDroneRiskConfig(clienteId: string): Promise<void> {
  try {
    await http.post('/seed/drone-risk-config', {
      clienteId,
      config: DEFAULT_DRONE_RISK_CONFIG,
      yoloClasses: DEFAULT_YOLO_CLASSES,
      synonyms: DEFAULT_YOLO_SYNONYMS,
    });
  } catch (err) {
    console.error('[seedDefaultDroneRiskConfig] Erro ao criar config drone padrão:', err);
  }
}
