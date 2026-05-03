export interface Cliente {
  id: string;
  nome: string;
  slug: string;
  cnpj: string | null;
  contato_email: string | null;
  contato_telefone: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  latitude_centro: number | null;
  longitude_centro: number | null;
  bounds: Record<string, unknown> | null;
  kmz_url: string | null;
  area: Record<string, unknown> | null;
  ativo: boolean;
  /** Sigla do estado (ex: SP). Obrigatório para sincronização CNES. */
  uf: string | null;
  /** Código IBGE do município (7 dígitos). Obrigatório para sincronização CNES. */
  ibge_municipio: string | null;
  created_at: string;
  updated_at: string;
  /** QW-10A: Soft delete — DELETE físico bloqueado por trigger. Null = ativo. */
  deleted_at?: string | null;
  /** QW-16: quando true bypassa enforcement de quota para levantamentos/vistorias. */
  surto_ativo?: boolean;
}

/**
 * Papéis canônicos do sistema (fonte: enum papel_app no banco + normalizePapel()).
 *
 * Escada de prioridade: admin(5) > supervisor(4) > agente(3) > notificador(2) > analista_regional(1)
 *
 * Mapeamento de legados (aplicado pela migration 20261015000000):
 *   'operador'       → 'agente'      (migrado no banco + normalizado no frontend)
 *   'moderador'      → 'supervisor'  (nunca esteve no enum; tratado defensivamente)
 *   'platform_admin' → removido dos dados
 *   'usuario'        → removido dos dados
 *
 * Regras de negócio:
 *   admin             — sem cliente_id (cross-tenant)
 *   supervisor        — com cliente_id obrigatório
 *   agente            — com cliente_id obrigatório
 *   notificador       — com cliente_id obrigatório
 *   analista_regional — sem cliente_id; com agrupamento_id obrigatório (cross-tenant read-only)
 */
export type PapelApp = 'admin' | 'supervisor' | 'agente' | 'notificador' | 'analista_regional';

export interface Usuario {
  id: string;
  auth_id: string;
  nome: string;
  email: string;
  cliente_id: string | null;
  /** P5: preenchido apenas para analista_regional; mutuamente exclusivo com cliente_id. */
  agrupamento_id: string | null;
  /** A08: false = usuário desativado no sistema. */
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

/** P5: Agrupamento regional (consórcio, região de saúde ou estado). */
export interface AgrupamentoRegional {
  id: string;
  nome: string;
  tipo: 'consorcio' | 'regiao_saude' | 'estado';
  uf: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

/** P5: Vínculo agrupamento ↔ município. */
export interface AgrupamentoCliente {
  agrupamento_id: string;
  cliente_id: string;
  adicionado_em: string;
}

/** P5: KPI agregado por município — retornado por v_regional_kpi_municipio. */
export interface RegionalKpiMunicipio {
  cliente_id: string;
  municipio_nome: string;
  cidade: string | null;
  uf: string | null;
  total_focos: number;
  focos_suspeita: number;
  focos_em_triagem: number;
  focos_aguarda_inspecao: number;
  focos_ativos: number;
  focos_confirmados: number;
  focos_em_tratamento: number;
  focos_resolvidos: number;
  focos_descartados: number;
  taxa_resolucao_pct: number;
  tempo_medio_resolucao_horas: number | null;
  sla_vencido_count: number;
  calculado_em: string;
}

/** P5: SLA por município — v_regional_sla_municipio. */
export interface RegionalSlaMunicipio {
  cliente_id: string;
  municipio_nome: string;
  cidade: string | null;
  uf: string | null;
  total_ativos: number;
  sla_ok: number;
  sla_atencao: number;
  sla_critico: number;
  sla_vencido: number;
  calculado_em: string;
}

/** P5: Uso do sistema por município — v_regional_uso_sistema. */
export interface RegionalUsoSistema {
  cliente_id: string;
  municipio_nome: string;
  cidade: string | null;
  uf: string | null;
  eventos_7d: number;
  distribuicoes_7d: number;
  inspecoes_iniciadas_7d: number;
  focos_resolvidos_7d: number;
  ultimo_evento_em: string | null;
  calculado_em: string;
}

/** P5: Vulnerabilidade por município — GET /analytics/regional/vulnerabilidade. */
export interface RegionalVulnerabilidadeMunicipio {
  cliente_id: string;
  municipio_nome: string;
  cidade: string | null;
  uf: string | null;
  total_vistorias: number;
  vulnerabilidade_baixa: number;
  vulnerabilidade_media: number;
  vulnerabilidade_alta: number;
  vulnerabilidade_critica: number;
  risco_vetorial_baixo: number;
  risco_vetorial_medio: number;
  risco_vetorial_alto: number;
  risco_vetorial_critico: number;
  alerta_saude_urgente: number;
  prioridade_p1: number;
  prioridade_p2: number;
  prioridade_p3: number;
  calculado_em: string;
}

/** P5: Resumo consolidado por município — GET /analytics/regional/resumo. */
export interface RegionalResumoMunicipio {
  cliente_id: string;
  municipio_nome: string;
  cidade: string | null;
  uf: string | null;
  total_focos: number;
  focos_ativos: number;
  focos_resolvidos: number;
  focos_descartados: number;
  taxa_resolucao_pct: number;
  sla_vencido_count: number;
  total_vistorias: number;
  vistorias_visitadas: number;
  vulnerabilidade_alta_count: number;
  vulnerabilidade_critica_count: number;
  risco_vetorial_alto_count: number;
  risco_vetorial_critico_count: number;
  alerta_saude_urgente_count: number;
  prioridade_p1_count: number;
  prioridade_p2_count: number;
  calculado_em: string;
}

export interface RegionalEvolucaoItem {
  periodo: string;                      // YYYY-MM
  total_focos: number;
  focos_ativos: number;
  focos_resolvidos: number;
  focos_descartados: number;
  taxa_resolucao_pct: number;
  sla_vencido_count: number;            // sempre 0 — métrica point-in-time, não histórica
  total_vistorias: number;
  vulnerabilidade_critica_count: number;
  risco_vetorial_critico_count: number;
  alerta_saude_urgente_count: number;
  prioridade_p1_count: number;
}

export interface RegionalMunicipioResumo {
  total_focos: number;
  focos_ativos: number;
  focos_resolvidos: number;
  focos_descartados: number;
  taxa_resolucao_pct: number;
  sla_vencido_count: number;
  total_vistorias: number;
  vulnerabilidade_alta_count: number;
  vulnerabilidade_critica_count: number;
  risco_vetorial_alto_count: number;
  risco_vetorial_critico_count: number;
  alerta_saude_urgente_count: number;
  prioridade_p1_count: number;
  prioridade_p2_count: number;
}

export interface RegionalMunicipioVulnerabilidade {
  total_vistorias: number;
  vulnerabilidade_baixa: number;
  vulnerabilidade_media: number;
  vulnerabilidade_alta: number;
  vulnerabilidade_critica: number;
  risco_vetorial_baixo: number;
  risco_vetorial_medio: number;
  risco_vetorial_alto: number;
  risco_vetorial_critico: number;
  alerta_saude_normal: number;
  alerta_saude_atencao: number;
  alerta_saude_urgente: number;
  prioridade_p1: number;
  prioridade_p2: number;
  prioridade_p3: number;
  prioridade_p4: number;
  prioridade_p5: number;
}

export interface RegionalMunicipioDetalhe {
  cliente: { id: string; nome: string; cidade?: string; uf?: string };
  resumo: RegionalMunicipioResumo;
  vulnerabilidade: RegionalMunicipioVulnerabilidade;
  evolucao: RegionalEvolucaoItem[];
  comparativo: RegionalComparativoResponse | null;
}

export interface RegionalComparativoPeriodo {
  data_inicio: string;
  data_fim: string;
  total_focos: number;
  focos_ativos: number;
  focos_resolvidos: number;
  focos_descartados: number;
  taxa_resolucao_pct: number;
  total_vistorias: number;
  vulnerabilidade_critica_count: number;
  risco_vetorial_critico_count: number;
  alerta_saude_urgente_count: number;
  prioridade_p1_count: number;
}

export interface RegionalComparativoVariacao {
  total_focos_pct: number | null;
  focos_ativos_pct: number | null;
  focos_resolvidos_pct: number | null;
  taxa_resolucao_pp: number;
  total_vistorias_pct: number | null;
  vulnerabilidade_critica_pct: number | null;
  risco_vetorial_critico_pct: number | null;
  alerta_saude_urgente_pct: number | null;
  prioridade_p1_pct: number | null;
}

export interface RegionalComparativoResponse {
  periodo_atual: RegionalComparativoPeriodo;
  periodo_anterior: RegionalComparativoPeriodo;
  variacao: RegionalComparativoVariacao;
}

export type LevantamentoTipoEntrada = 'DRONE' | 'MANUAL';

export interface Levantamento {
  id: string;
  cliente_id: string;
  usuario_id: string;
  planejamento_id: string | null;
  titulo: string;
  data_voo: string;
  total_itens: number;
  tipo_entrada: LevantamentoTipoEntrada | null;
  /**
   * Fonte da configuração usada pelo pipeline drone.
   * 'supabase' = config veio do banco (ideal).
   * 'local_json' ou 'local_json:yolo,risk' = fallback para JSON local.
   * NULL = levantamento manual ou anterior a este recurso.
   */
  config_fonte?: string | null;
  created_at: string;
  // joined
  cliente?: Cliente;
  usuario?: Usuario;
  planejamento?: Planejamento;
}

export type StatusAtendimento = 'pendente' | 'em_atendimento' | 'resolvido';

/** Agregação por status para o dashboard (conta todos os itens do cliente, sem limite de linhas). */
export interface AtendimentoStatusCounts {
  total: number;
  pendente: number;
  em_atendimento: number;
  resolvido: number;
}

export interface LevantamentoItem {
  id: string;
  levantamento_id: string;
  arquivo: string | null;
  latitude: number | null;
  longitude: number | null;
  item: string | null;
  risco: string | null;
  peso: number | null;
  acao: string | null;
  score_final: number | null;
  prioridade: string | null;
  sla_horas: number | null;
  endereco_curto: string | null;
  endereco_completo: string | null;
  image_url: string | null;
  uuid_img: string | null;
  maps: string | null;
  waze: string | null;
  data_hora: string | null;
  /** A01: Denormalizado de levantamentos.cliente_id para RLS direto. Preenchido por trigger. */
  cliente_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  updated_at?: string;
  /** Último usuário a alterar o item. Preenchido pelo trigger trg_set_updated_by. (QW-07) */
  updated_by: string | null;
  // drone e voo
  id_drone: string | null;
  altitude_m: number | null;
  altura_relativa_m: number | null;
  // câmera
  focal_mm: number | null;
  iso: number | null;
  exposure_s: number | null;
  resolucao_largura_px: number | null;
  resolucao_altura_px: number | null;
  megapixels: number | null;
  // orientação
  inclinacao_camera_graus: number | null;
  direcao_yaw_graus: number | null;
  inclinacao_lateral_roll_graus: number | null;
  inclinacao_frontal_pitch_graus: number | null;
  /**
   * @virtual — nunca persistido. api.itens.updateObservacaoAtendimento é no-op após migration 20260711.
   * Use focos_risco.desfecho para observações persistidas.
   */
  observacao_atendimento?: string | null;
  /**
   * @virtual — reconstruído de focos_risco por enrichItensComFoco() em api.ts.
   * Não existe mais como coluna em levantamento_itens (removida em migration 20260711).
   * Source of truth: foco_risco_status / focos_risco.status.
   */
  status_atendimento?: StatusAtendimento;
  /**
   * @virtual — reconstruído de focos_risco.desfecho por enrichItensComFoco() em api.ts.
   * Não existe mais como coluna em levantamento_itens (removida em migration 20260711).
   */
  acao_aplicada?: string | null;
  /**
   * @virtual — reconstruído de focos_risco.resolvido_em por enrichItensComFoco() em api.ts.
   * Não existe mais como coluna em levantamento_itens (removida em migration 20260711).
   */
  data_resolucao?: string | null;
  /** ID do foco_risco vinculado a este item (source of truth para status desde migration 20260710). */
  foco_risco_id?: string | null;
  /** @virtual — código legível do foco vinculado (ex.: 2027-00000001). Extraído via enrichItensComFoco(). */
  codigo_foco?: string | null;
  /** Status do foco_risco vinculado, mapeado para o modelo de 3 estados no frontend. */
  foco_risco_status?: FocoRiscoStatus | null;
  /**
   * Caixa de detecção YOLO principal gravada pelo pipeline Python.
   * - bbox_xyxy: cantos em pixels na imagem original [x1, y1, x2, y2]
   * - bbox_norm: mesmos cantos normalizados 0–1 (usar para overlay CSS com %)
   * - image_width / image_height: dimensões usadas na inferência
   * Null para itens manuais, análises antigas ou score abaixo do limiar.
   */
  detection_bbox?: {
    bbox_xyxy?: number[];
    bbox_norm?: number[];
    image_width?: number;
    image_height?: number;
  } | null;
  // joined
  levantamento?: Levantamento;
  drone?: Drone;
  /** QW-10A: Soft delete. Null = ativo. */
  deleted_at?: string | null;
  deleted_by?: string | null;
}

/**
 * Uma detecção individual do array yolo_detections por foto.
 * Fonte de verdade em SQL — não usar payload.yolo_detections para listagens.
 * A detecção principal de negócio está em levantamento_itens.detection_bbox.
 */
export interface LevantamentoItemDetecao {
  id: string;
  levantamento_item_id: string;
  /** Índice 0-based no array yolo_detections original. */
  ordem: number;
  class_name: string;
  /** Score 0–1. Null quando não gravado pelo pipeline. */
  confidence: number | null;
  /** Cantos em pixels na imagem original [x1, y1, x2, y2]. */
  bbox_xyxy: [number, number, number, number] | null;
  /** Cantos normalizados 0–1 [nx1, ny1, nx2, ny2]. Usar para overlay CSS. */
  bbox_norm: [number, number, number, number] | null;
  created_at: string;
}

export type PlanejamentoTipo = 'planejamento' | 'execucao' | 'realizado';

export type PlanejamentoTipoLevantamento = 'DRONE' | 'MANUAL';

export interface Planejamento {
  id: string;
  descricao: string | null;
  data_planejamento: string;
  cliente_id: string | null;
  area_total: number | null;
  altura_voo: number | null;
  area: Record<string, unknown> | null;
  tipo: PlanejamentoTipo | null;
  /** Tipo do levantamento gerado a partir deste planejamento: DRONE ou MANUAL (coluna no DB: tipo_levantamento). */
  tipo_entrada?: PlanejamentoTipoLevantamento | null;
  /** Coluna no banco; usar este valor ao ler/escrever. */
  tipo_levantamento?: PlanejamentoTipoLevantamento | null;
  ativo?: boolean;
  /** FK para regioes — usada para resolver sla_config_regiao. */
  regiao_id?: string | null;
  created_at: string;
  updated_at: string;
  // joined
  cliente?: Cliente;
  regiao?: Pick<Regiao, 'id' | 'regiao'>;
}

export interface Tag {
  id: string;
  slug: string;
  label: string;
  created_at: string;
}

export interface LevantamentoItemTag {
  levantamento_item_id: string;
  tag_id: string;
  created_at: string;
}

/**
 * Trilha de auditoria das mudanças de status_atendimento em um levantamento_item.
 * Populada automaticamente pelo trigger trg_levantamento_item_status_historico.
 */
export interface LevantamentoItemStatusHistorico {
  id: string;
  levantamento_item_id: string;
  cliente_id: string;
  status_anterior: StatusAtendimento | null;
  status_novo: StatusAtendimento;
  acao_aplicada_anterior: string | null;
  acao_aplicada_nova: string | null;
  alterado_por: string | null;
  alterado_em: string;
  // joined (opcional)
  usuario?: Pick<Usuario, 'id' | 'nome'>;
}

/** Ação corretiva do catálogo configurável por cliente. Agente seleciona ao concluir atendimento. */
export interface PlanoAcaoCatalogo {
  id: string;
  cliente_id: string;
  label: string;
  descricao: string | null;
  /** Filtro por tipo de item. NULL = ação genérica, aparece para qualquer tipo. */
  tipo_item: string | null;
  ativo: boolean;
  ordem: number;
  created_at: string;
}

/**
 * Shape de cluster de focos recorrentes no mesmo local (endereço idêntico ou raio 50m).
 * Sistema canônico: focos_risco.foco_anterior_id + trigger trg_elevar_prioridade_recorrencia.
 * Preenchido por api.recorrencias.listAtivasByCliente() agrupando focos_risco por endereco_normalizado.
 * NOTA: a tabela levantamento_item_recorrencia e o trigger trg_levantamento_item_recorrencia
 * foram removidos (migração 4B). Esta interface é mantida como shape de compatibilidade.
 */
export interface LevantamentoItemRecorrencia {
  id: string;
  cliente_id: string;
  endereco_ref: string | null;
  latitude_ref: number | null;
  longitude_ref: number | null;
  total_ocorrencias: number;
  primeira_ocorrencia_id: string | null;
  ultima_ocorrencia_id: string | null;
  primeira_ocorrencia_em: string;
  ultima_ocorrencia_em: string;
  created_at: string;
  updated_at: string;
}

/**
 * Cluster ativo de recorrência — shape retornado por api.recorrencias.listAtivasByCliente().
 * Fonte: focos_risco agrupados por endereco_normalizado na janela de 30 dias (não uma view SQL).
 */
export interface RecorrenciaAtiva extends LevantamentoItemRecorrencia {
  ultimo_item: string | null;
  ultimo_risco: string | null;
  ultima_prioridade: string | null;
  ultimo_endereco_curto: string | null;
  ultima_image_url: string | null;
}

/** Feriado municipal/nacional registrado por cliente. Usado no cálculo de prazo_final em horário comercial. */
export interface SlaFeriado {
  id: string;
  cliente_id: string;
  data: string;       // ISO date "YYYY-MM-DD"
  descricao: string;
  nacional: boolean;
  created_at: string;
}

/** Row da view v_slas_iminentes — SLAs nos últimos 20% do prazo. */
export interface SlaIminente {
  id: string;
  cliente_id: string;
  item_id: string | null;
  levantamento_item_id: string | null;
  prioridade: string;
  sla_horas: number;
  inicio: string;
  prazo_final: string;
  status: string;
  escalonado: boolean;
  escalonado_automatico: boolean;
  minutos_restantes: number;
  pct_consumido: number;
}

/** Configuração de SLA por região (override do config cliente-wide). */
export interface SlaConfigRegiao {
  id: string;
  cliente_id: string;
  regiao_id: string;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // joined
  regiao?: Pick<Regiao, 'id' | 'regiao'>;
}

/** Limites de uso mensal/total por cliente. NULL = ilimitado. */
export interface ClienteQuota {
  id: string;
  cliente_id: string;
  voos_mes: number | null;
  levantamentos_mes: number | null;
  itens_mes: number | null;
  usuarios_ativos: number | null;
  /** QW-16 — novos campos */
  vistorias_mes: number | null;
  ia_calls_mes: number | null;
  storage_gb: number | null;
  created_at: string;
  updated_at: string;
}

/** Linha da view v_cliente_uso_mensal — uso corrente vs. limites. */
export interface ClienteUsoMensal {
  cliente_id: string;
  cliente_nome: string;
  voos_mes_usado: number;
  voos_mes_limite: number | null;
  levantamentos_mes_usado: number;
  levantamentos_mes_limite: number | null;
  itens_mes_usado: number;
  itens_mes_limite: number | null;
  usuarios_ativos_usado: number;
  usuarios_ativos_limite: number | null;
  /** QW-16 — novos campos */
  vistorias_mes_usado: number;
  vistorias_mes_limite: number | null;
  ia_calls_mes_usado: number;
  ia_calls_mes_limite: number | null;
  storage_gb_usado: number;
  storage_gb_limite: number | null;
  voos_excedido: boolean;
  levantamentos_excedido: boolean;
  itens_excedido: boolean;
  usuarios_excedido: boolean;
  /** QW-16 — novos flags */
  vistorias_excedido: boolean;
  ia_calls_excedido: boolean;
}

// ─── P1-3 Audit Log ──────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  cliente_id: string | null;
  usuario_id: string | null;
  auth_uid: string | null;
  acao: string;
  tabela: string | null;
  registro_id: string | null;
  ip_hash: string | null;
  descricao: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
}

// ─── QW-15 Billing ───────────────────────────────────────────────────────────

export type PlanoBilling = 'basico' | 'profissional' | 'enterprise';
export type StatusClientePlano = 'ativo' | 'trial' | 'suspenso' | 'cancelado' | 'inadimplente';
export type StatusBillingCiclo = 'aberto' | 'fechado' | 'faturado' | 'pago' | 'inadimplente';

export interface Plano {
  id: string;
  nome: PlanoBilling;
  descricao: string | null;
  preco_mensal: number | null;
  limite_usuarios: number | null;
  limite_imoveis: number | null;
  limite_vistorias_mes: number | null;
  limite_levantamentos_mes: number | null;
  limite_voos_mes: number | null;
  limite_storage_gb: number | null;
  limite_ia_calls_mes: number | null;
  limite_denuncias_mes: number | null;
  drone_habilitado: boolean;
  sla_avancado: boolean;
  integracoes_habilitadas: string[];
  ativo: boolean;
  ordem: number;
  created_at: string;
}

export interface ClientePlano {
  id: string;
  cliente_id: string;
  plano_id: string;
  data_inicio: string;
  data_fim: string | null;
  /** P1-2: expiração do trial. null = sem prazo. */
  data_trial_fim: string | null;
  status: StatusClientePlano;
  limites_personalizados: Record<string, unknown> | null;
  contrato_ref: string | null;
  observacao: string | null;
  created_at: string;
  updated_at: string;
  plano?: Plano;
}

export interface BillingCiclo {
  id: string;
  cliente_id: string;
  cliente_plano_id: string | null;
  periodo_inicio: string;
  periodo_fim: string;
  status: StatusBillingCiclo;
  valor_base: number | null;
  valor_excedente: number;
  valor_total: number | null;
  nota_fiscal_ref: string | null;
  pago_em: string | null;
  observacao: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillingUsageSnapshot {
  id: string;
  cliente_id: string;
  billing_ciclo_id: string | null;
  periodo_inicio: string;
  periodo_fim: string;
  vistorias_mes: number;
  levantamentos_mes: number;
  itens_focos_mes: number;
  voos_mes: number;
  denuncias_mes: number;
  ia_calls_mes: number;
  relatorios_mes: number;
  syncs_cnes_mes: number;
  notificacoes_esus_mes: number;
  usuarios_ativos_mes: number;
  imoveis_total: number;
  storage_gb: number;
  calculado_em: string;
  payload_detalhado: Record<string, unknown> | null;
}

export interface BillingResumo {
  cliente_id: string;
  cliente_nome: string;
  plano_id: string | null;
  plano_nome: PlanoBilling | null;
  plano_status: StatusClientePlano | null;
  contrato_ref: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  ultimo_snapshot_inicio: string | null;
  vistorias_mes: number | null;
  levantamentos_mes: number | null;
  itens_focos_mes: number | null;
  ia_calls_mes: number | null;
  storage_gb: number | null;
  usuarios_ativos_mes: number | null;
  snapshot_calculado_em: string | null;
  limite_vistorias_mes: number | null;
  limite_ia_calls_mes: number | null;
  limite_storage_gb: number | null;
  limite_usuarios: number | null;
}

/** Resultado de cliente_verificar_quota. */
export interface QuotaVerificacao {
  ok: boolean;
  usado: number;
  limite: number | null;
}

/** Resultado da avaliação de condições meteorológicas para voo de drone. */
export interface CondicaoVoo {
  apto: boolean;
  nivel_risco: string | null;
  motivos: string[];
  vento_kmh: number | null;
  chuva_24h_mm: number | null;
  prev_d1_mm: number | null;
  temp_c: number | null;
  dt_ref: string | null;
}

/** Assinatura Web Push de um usuário — usada pela Edge Function sla-push-critico. */
export interface PushSubscription {
  id: string;
  usuario_id: string;
  cliente_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
}

/** Feedback de agente sobre detecção YOLO — base para re-treino. */
export interface YoloFeedback {
  id: string;
  levantamento_item_id: string;
  cliente_id: string;
  confirmado: boolean;
  observacao: string | null;
  registrado_por: string | null;
  created_at: string;
}

/** Sumário IA pós-voo gerado pela Edge Function triagem-ia-pos-voo. */
export interface LevantamentoAnaliseIa {
  id: string;
  levantamento_id: string;
  cliente_id: string;
  modelo: string;
  total_focos: number;
  total_clusters: number;
  falsos_positivos: number;
  sumario: string;
  clusters: unknown[] | null;
  created_at: string;
}

/** Evidência fotográfica do atendimento anexada ao item no painel de detalhes (Meus itens). */
export interface LevantamentoItemEvidencia {
  id: string;
  levantamento_item_id: string;
  image_url: string;
  legenda: string | null;
  created_at: string;
}

export interface Voo {
  id: string;
  planejamento_id: string | null;
  voo_numero: number | null;
  inicio: string;
  fim: string | null;
  duracao_min: number | null;
  km: number | null;
  ha: number | null;
  baterias: number | null;
  fotos: number | null;
  amostra_lat: number | null;
  amostra_lon: number | null;
  amostra_data_hora: string | null;
  amostra_arquivo: string | null;
  wx_error: string | null;
  wx_detail: string | null;
  /** Usuário que executou o voo (piloto / operador responsável). */
  piloto_id: string | null;
  created_at: string;
  updated_at: string;
  // joined
  planejamento?: Planejamento;
  piloto?: Pick<Usuario, 'id' | 'nome'>;
}

export type DroneProprietario = 'proprio' | 'terceiro';

export interface Drone {
  id: string;
  marca: string;
  modelo: string;
  baterias: string;
  specs: string;
  ativo: boolean;
  proprietario: DroneProprietario;
  created_at: string;
  updated_at: string;
}

export interface Regiao {
  id: string;
  cliente_id: string;
  regiao: string;
  latitude: number | null;
  longitude: number | null;
  area: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  // joined
  cliente?: Cliente;
}

export interface PluvioRisco {
  id: string;
  regiao_id: string;
  dt_ref: string;
  chuva_24h: number | null;
  chuva_72h: number | null;
  chuva_7d: number | null;
  dias_pos_chuva: number | null;
  janela_sem_chuva: string | null;
  persistencia_7d: number | null;
  tendencia: string | null;
  situacao_ambiental: string | null;
  prob_label: string | null;
  prob_base_min: number | null;
  prob_base_max: number | null;
  prob_final_min: number | null;
  prob_final_max: number | null;
  classificacao_final: string | null;
  temp_c: number | null;
  vento_kmh: number | null;
  temp_med_c: number | null;
  vento_med_kmh: number | null;
  prev_d1_mm: number | null;
  prev_d2_mm: number | null;
  prev_d3_mm: number | null;
  created_at: string;
  updated_at: string;
  // joined
  regiao?: Regiao;
}

// =========================================
// Risk Policy types
// =========================================

export interface SentinelaRiskPolicy {
  id: string;
  cliente_id: string;
  name: string;
  version: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // joined
  cliente?: Cliente;
}

export interface SentinelaRiskDefaults {
  id: string;
  policy_id: string;
  chuva_relevante_mm: number;
  dias_lookup_max: number;
  tendencia_dias: number;
  created_at: string;
}

export interface SentinelaRiskBinSemChuva {
  id: string;
  policy_id: string;
  idx: number;
  min_val: number;
  max_val: number;
}

export interface SentinelaRiskBinIntensidadeChuva {
  id: string;
  policy_id: string;
  idx: number;
  min_val: number;
  max_val: number;
}

export interface SentinelaRiskBinPersistencia7d {
  id: string;
  policy_id: string;
  idx: number;
  min_val: number;
  max_val: number;
}

export interface SentinelaRiskFallbackRule {
  id: string;
  policy_id: string;
  situacao_ambiental: string;
  probabilidade_label: string;
  probabilidade_pct_min: number;
  probabilidade_pct_max: number;
  classificacao: string;
  icone: string;
  severity: number;
  created_at: string;
}

export interface SentinelaRiskRule {
  id: string;
  policy_id: string;
  idx: number;
  chuva_mm_min: number;
  chuva_mm_max: number;
  dias_min: number;
  dias_max: number;
  situacao_ambiental: string;
  probabilidade_label: string;
  probabilidade_pct_min: number;
  probabilidade_pct_max: number;
  classificacao: string;
  icone: string;
  severity: number;
  created_at: string;
}

export interface SentinelaRiskTempFactor {
  id: string;
  policy_id: string;
  idx: number;
  temp_min: number;
  temp_max: number;
  factor: number;
}

export interface SentinelaRiskVentoFactor {
  id: string;
  policy_id: string;
  idx: number;
  vento_min: number;
  vento_max: number;
  factor: number;
}

export interface SentinelaRiskTempAdjustPp {
  id: string;
  policy_id: string;
  idx: number;
  temp_min: number;
  temp_max: number;
  delta_pp: number;
}

export interface SentinelaRiskVentoAdjustPp {
  id: string;
  policy_id: string;
  idx: number;
  vento_min: number;
  vento_max: number;
  delta_pp: number;
}

export interface SentinelaRiskPersistenciaAdjustPp {
  id: string;
  policy_id: string;
  idx: number;
  dias_min: number;
  dias_max: number;
  delta_pp: number;
}

export type TendenciaTipo = 'crescente' | 'estavel' | 'decrescente';

export interface SentinelaRiskTendenciaAdjustPp {
  id: string;
  policy_id: string;
  tendencia: TendenciaTipo;
  delta_pp: number;
}

// =========================================
// Drone Risk Config types
// =========================================

export type DroneRisco = 'baixo' | 'medio' | 'alto';
export type DronePrioridade = 'P1' | 'P2' | 'P3' | 'P4' | 'P5';

export interface SentinelaDroneRiskConfig {
  id: string;
  cliente_id: string;
  base_by_risco: Record<DroneRisco, number>;
  priority_thresholds: Record<DronePrioridade, number>;
  sla_by_priority_hours: Record<DronePrioridade, number>;
  confidence_multiplier: number;
  item_overrides: Record<string, { min_score?: number; force_priority?: DronePrioridade }>;
  created_at: string;
  updated_at: string;
}

export interface SentinelaYoloClassConfig {
  id: string;
  cliente_id: string;
  item_key: string;
  item: string;
  risco: DroneRisco;
  peso: number;
  acao: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SentinelaYoloSynonym {
  id: string;
  cliente_id: string;
  synonym: string;
  maps_to: string;
  created_at: string;
}

// =========================================
// Pluvio Operacional types
// =========================================

export interface PluvioOperacionalRun {
  id: string;
  cliente_id: string;
  dt_ref: string;
  dt_gerado: string;
  total_bairros: number;
  created_at: string;
  // joined
  cliente?: Cliente;
  items?: PluvioOperacionalItem[];
}

export interface PluvioOperacionalItem {
  id: string;
  run_id: string;
  regiao_id: string | null;
  bairro_nome: string;
  classificacao_risco: string;
  situacao_ambiental: string | null;
  chuva_24h_mm: number | null;
  chuva_72h_mm: number | null;
  chuva_7d_mm: number | null;
  dias_com_chuva_7d: number | null;
  janela_sem_chuva: string | null;
  persistencia_7d: string | null;
  tendencia: string | null;
  temp_media_c: number | null;
  vento_medio_kmh: number | null;
  prob_label: string | null;
  prob_base_min: number | null;
  prob_base_max: number | null;
  prob_final_min: number | null;
  prob_final_max: number | null;
  criadouro_ativo: string | null;
  velocidade_ciclo: string | null;
  janela_emergencia_dias: string | null;
  prioridade_operacional: string;
  prazo_acao: string | null;
  created_at: string;
  // joined
  regiao?: Regiao;
}

export interface MunicipioStats {
  clienteId: string;
  nome: string;
  total: number;
  resolvidos: number;
  pendentes: number;
  em_atendimento: number;
  criticos: number;
  altos: number;
}

// ── Centro de Notificações de Casos ──────────────────────────────────────────

export type DoencaNotificada = 'dengue' | 'chikungunya' | 'zika' | 'suspeito';
export type StatusCaso = 'suspeito' | 'confirmado' | 'descartado';
export type TipoUnidadeSaude = 'ubs' | 'upa' | 'hospital' | 'outro';
export type TipoSentinelaUnidade = 'UBS' | 'USF' | 'UPA' | 'HOSPITAL' | 'CEM' | 'VIGILANCIA' | 'OUTRO';

export interface UnidadeSaude {
  id: string;
  cliente_id: string;
  nome: string;
  tipo: TipoUnidadeSaude;
  endereco: string | null;
  latitude: number | null;
  longitude: number | null;
  ativo: boolean;
  /** Código CNES do estabelecimento (chave de upsert na sincronização). */
  cnes: string | null;
  /** Classificação interna do Sentinella — mais granular que `tipo`. */
  tipo_sentinela: TipoSentinelaUnidade;
  telefone: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  /** 'manual' = cadastrado pela prefeitura; 'cnes_sync' = importado do CNES/DATASUS. */
  origem: 'manual' | 'cnes_sync';
  ultima_sync_em: string | null;
  created_at: string;
  updated_at: string;
}

/** Registro de cada execução de sincronização CNES (agendada ou manual). */
export interface UnidadesSaudeSyncControle {
  id: string;
  cliente_id: string;
  status: 'pendente' | 'em_andamento' | 'sucesso' | 'erro';
  origem_execucao: 'agendado' | 'manual';
  iniciado_em: string;
  finalizado_em: string | null;
  usuario_id: string | null;
  total_recebidos: number | null;
  total_inseridos: number | null;
  total_atualizados: number | null;
  total_inativados: number | null;
  erro_mensagem: string | null;
  created_at: string;
}

/** Log linha a linha de cada estabelecimento processado numa execução CNES. */
export interface UnidadesSaudeSyncLog {
  id: string;
  controle_id: string;
  cliente_id: string;
  cnes: string | null;
  acao: 'inserido' | 'atualizado' | 'inativado' | 'ignorado' | 'erro';
  mensagem: string | null;
  created_at: string;
}

/** LGPD: sem nome, CPF ou qualquer identificador direto do paciente. */
export interface CasoNotificado {
  id: string;
  cliente_id: string;
  unidade_saude_id: string;
  notificador_id: string | null;
  doenca: DoencaNotificada;
  status: StatusCaso;
  data_inicio_sintomas: string | null;
  data_notificacao: string;
  logradouro_bairro: string | null;
  bairro: string | null;
  latitude: number | null;
  longitude: number | null;
  regiao_id: string | null;
  observacao: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  /** M07: Usuário que registrou o caso. Preenchido por trigger BEFORE INSERT. */
  created_by: string | null;
  /** QW-10A: Soft delete — dados de saúde pública preservados. Null = ativo. */
  deleted_at?: string | null;
  deleted_by?: string | null;
  // joined
  unidade_saude?: UnidadeSaude;
  notificador?: Pick<Usuario, 'id' | 'nome' | 'email'>;
}

/** Vínculo automático criado pelo trigger trg_cruzar_caso_focos. Nunca inserir manualmente. */
export interface CasoFocoCruzamento {
  id: string;
  caso_id: string;
  levantamento_item_id: string;
  distancia_metros: number;
  criado_em: string;
  caso?: CasoNotificado;
  levantamento_item?: LevantamentoItem;
}

// ── Módulo de Vistoria de Campo (e-VISITA PNCD) ───────────────────────────────

export type TipoImovel = 'residencial' | 'comercial' | 'terreno' | 'ponto_estrategico';
export type TipoAtividade = 'tratamento' | 'pesquisa' | 'liraa' | 'ponto_estrategico';
export type StatusVistoria = 'pendente' | 'visitado' | 'fechado' | 'revisita';
export type TipoDeposito = 'A1' | 'A2' | 'B' | 'C' | 'D1' | 'D2' | 'E';

export const DEPOSITO_LABELS: Record<TipoDeposito, string> = {
  A1: "Caixa d'água elevada",
  A2: 'Outro armazenamento de água',
  B: 'Pequenos depósitos móveis',
  C: 'Depósitos fixos',
  D1: 'Pneus e materiais rodantes',
  D2: 'Lixo (rec. plást., latas, suc., ent.)',
  E: 'Depósitos naturais',
};

export interface Imovel {
  id: string;
  cliente_id: string;
  regiao_id: string | null;
  tipo_imovel: TipoImovel;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  quarteirao: string | null;
  latitude: number | null;
  longitude: number | null;
  ativo: boolean;
  // Perfil de acesso
  proprietario_ausente: boolean;
  tipo_ausencia: string | null;
  contato_proprietario: string | null;
  tem_animal_agressivo: boolean;
  historico_recusa: boolean;
  tem_calha: boolean;
  calha_acessivel: boolean;
  prioridade_drone: boolean;
  notificacao_formal_em: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImovelResumo {
  id: string;
  cliente_id: string;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  quarteirao: string | null;
  regiao_id: string | null;
  tipo_imovel: string;
  latitude: number | null;
  longitude: number | null;
  ativo: boolean;
  historico_recusa: boolean;
  prioridade_drone: boolean;
  tem_calha: boolean;
  calha_acessivel: boolean;
  created_at: string;
  updated_at: string;
  total_vistorias: number;
  ultima_visita: string | null;
  tentativas_sem_acesso: number;
  total_focos_historico: number;
  focos_ativos: number;
  ultimo_foco_em: string | null;
  slas_abertos: number;
  focos_recorrentes: number;
  score_territorial: number | null;
  score_classificacao: 'baixo' | 'medio' | 'alto' | 'muito_alto' | 'critico' | null;
  score_fatores: Record<string, unknown> | null;
  score_calculado_em: string | null;
}

export interface Vistoria {
  id: string;
  cliente_id: string;
  imovel_id: string;
  agente_id: string;
  planejamento_id: string | null;
  ciclo: number;
  tipo_atividade: TipoAtividade;
  data_visita: string;
  status: StatusVistoria;
  moradores_qtd: number | null;
  gravidas: number;
  idosos: number;
  criancas_7anos: number;
  lat_chegada: number | null;
  lng_chegada: number | null;
  checkin_em: string | null;
  observacao: string | null;
  // Campos de controle de acesso
  acesso_realizado: boolean;
  motivo_sem_acesso: MotivoSemAcesso | null;
  proximo_horario_sugerido: HorarioSugerido | null;
  observacao_acesso: string | null;
  foto_externa_url: string | null;
  assinatura_responsavel_url: string | null;
  // Pendências de evidências perdidas durante sincronização offline (QW-05)
  pendente_assinatura: boolean;
  pendente_foto: boolean;
  /** true quando criada offline e sincronizada posteriormente. (QW-07) */
  origem_offline: boolean;
  payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  /** M07: Usuário que criou a vistoria. Preenchido por trigger BEFORE INSERT. */
  created_by: string | null;
  // ── Consolidação automática (Fases 1–3) ────────────────────────────────
  resultado_operacional:      'visitado' | 'sem_acesso' | 'sem_acesso_retorno' | null;
  vulnerabilidade_domiciliar: 'baixa' | 'media' | 'alta' | 'critica' | 'inconclusivo' | null;
  alerta_saude:               'nenhum' | 'atencao' | 'urgente' | 'inconclusivo' | null;
  risco_socioambiental:       'baixo' | 'medio' | 'alto' | 'inconclusivo' | null;
  risco_vetorial:             'baixo' | 'medio' | 'alto' | 'critico' | 'inconclusivo' | null;
  prioridade_final:           'P1' | 'P2' | 'P3' | 'P4' | 'P5' | null;
  prioridade_motivo:          string | null;
  dimensao_dominante:         string | null;
  consolidacao_resumo:        string | null;
  consolidacao_json:          Record<string, unknown> | null;
  consolidacao_incompleta:    boolean;
  versao_regra_consolidacao:  string | null;
  versao_pesos_consolidacao:  string | null;
  consolidado_em:             string | null;
  reprocessado_em:            string | null;
  reprocessado_por:           string | null;
  // joined
  imovel?: Imovel;
  agente?: Pick<Usuario, 'id' | 'nome'>;
}

export interface VistoriaDeposito {
  id: string;
  vistoria_id: string;
  tipo: TipoDeposito;
  qtd_inspecionados: number;
  qtd_com_agua: number;
  qtd_com_focos: number;
  qtd_eliminados: number;
  eliminado: boolean;
  vedado: boolean;
  usou_larvicida: boolean;
  qtd_larvicida_g: number | null;
  ia_identificacao: Record<string, unknown> | null;
  created_at: string;
}

/** LGPD: registra apenas contagem e sintomas — sem identificação de moradores. */
export interface VistoriaSintomas {
  id: string;
  vistoria_id: string;
  cliente_id: string;
  febre: boolean;
  manchas_vermelhas: boolean;
  dor_articulacoes: boolean;
  dor_cabeca: boolean;
  moradores_sintomas_qtd: number;
  gerou_caso_notificado_id: string | null;
  created_at: string;
}

export interface VistoriaRiscos {
  id: string;
  vistoria_id: string;
  // Risco Social
  menor_incapaz: boolean;
  idoso_incapaz: boolean;
  dep_quimico: boolean;
  risco_alimentar: boolean;
  risco_moradia: boolean;
  // Risco Sanitário
  criadouro_animais: boolean;
  lixo: boolean;
  residuos_organicos: boolean;
  residuos_quimicos: boolean;
  residuos_medicos: boolean;
  // Risco Vetorial
  acumulo_material_organico: boolean;
  animais_sinais_lv: boolean;
  caixa_destampada: boolean;
  outro_risco_vetorial: string | null;
  created_at: string;
}

export interface VistoriaResumo {
  pendentes: number;
  visitados: number;
  meta: number;
  cobertura_pct: number;
}

// ── Módulo de Acesso e Calhas ─────────────────────────────────────────────────

export type MotivoSemAcesso =
  | 'fechado_ausente'
  | 'fechado_viagem'
  | 'recusa_entrada'
  | 'cachorro_bravo'
  | 'calha_inacessivel'
  | 'outro';

export type HorarioSugerido = 'manha' | 'tarde' | 'fim_de_semana' | 'sem_previsao';

export type PosicaoCalha = 'frente' | 'lateral_dir' | 'lateral_esq' | 'fundo' | 'todas';
export type CondicaoCalha = 'limpa' | 'entupida' | 'com_folhas' | 'danificada' | 'com_agua_parada';

export const MOTIVO_LABELS: Record<MotivoSemAcesso, string> = {
  fechado_ausente:   'Fechado — morador ausente no expediente',
  fechado_viagem:    'Fechado — proprietário mora em outra cidade',
  recusa_entrada:    'Morador recusou entrada',
  cachorro_bravo:    'Animal agressivo impediu acesso',
  calha_inacessivel: 'Calha visível mas inacessível',
  outro:             'Outro motivo',
};

export const HORARIO_LABELS: Record<HorarioSugerido, string> = {
  manha:         'Manhã (antes das 10h)',
  tarde:         'Tarde (após 14h)',
  fim_de_semana: 'Fim de semana',
  sem_previsao:  'Sem previsão de acesso',
};

export const CONDICAO_CALHA_LABELS: Record<CondicaoCalha, string> = {
  limpa:           'Limpa',
  entupida:        'Entupida',
  com_folhas:      'Com folhas',
  danificada:      'Danificada',
  com_agua_parada: 'Com água parada',
};

export const POSICAO_CALHA_LABELS: Record<PosicaoCalha, string> = {
  frente:      'Frente',
  lateral_dir: 'Lateral direita',
  lateral_esq: 'Lateral esquerda',
  fundo:       'Fundo',
  todas:       'Todas',
};

export interface VistoriaCalha {
  id: string;
  vistoria_id: string;
  posicao: PosicaoCalha;
  condicao: CondicaoCalha;
  com_foco: boolean;
  acessivel: boolean;
  tratamento_realizado: boolean;
  foto_url: string | null;
  observacao: string | null;
  created_at: string;
}

export interface ImovelHistoricoAcesso {
  imovel_id: string;
  cliente_id: string;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  quarteirao: string | null;
  proprietario_ausente: boolean;
  tipo_ausencia: string | null;
  tem_animal_agressivo: boolean;
  historico_recusa: boolean;
  prioridade_drone: boolean;
  tem_calha: boolean;
  calha_acessivel: boolean;
  notificacao_formal_em: string | null;
  total_visitas: number;
  total_sem_acesso: number;
  pct_sem_acesso: number;
  ultima_visita_com_acesso: string | null;
  ultima_tentativa: string | null;
  requer_notificacao_formal: boolean;
}

// ── Módulo de Integração e-SUS Notifica ───────────────────────────────────────

export type TipoIntegracao = 'esus_notifica' | 'rnds';
export type AmbienteIntegracao = 'homologacao' | 'producao';
export type StatusNotificacaoESUS = 'pendente' | 'enviado' | 'erro' | 'descartado';
export type TipoAgravoESUS = 'dengue' | 'chikungunya' | 'zika' | 'suspeito';

export interface ClienteIntegracao {
  id: string;
  cliente_id: string;
  tipo: TipoIntegracao;
  /** api_key nunca retornada pelo SELECT padrão — usar api.integracoes.revelarChave() */
  api_key?: string;
  /** Coluna calculada: primeiros 4 + últimos 4 chars, meio mascarado */
  api_key_masked?: string;
  endpoint_url: string;
  codigo_ibge: string | null;
  unidade_saude_cnes: string | null;
  ambiente: AmbienteIntegracao;
  ativo: boolean;
  ultima_sincronizacao: string | null;
  created_at: string;
  updated_at: string;
}

export interface ItemNotificacaoESUS {
  id: string;
  cliente_id: string;
  levantamento_item_id: string | null;
  tipo_agravo: TipoAgravoESUS;
  numero_notificacao: string | null;
  status: StatusNotificacaoESUS;
  payload_enviado: Record<string, unknown> | null;
  resposta_api: Record<string, unknown> | null;
  erro_mensagem: string | null;
  enviado_por: string | null;
  created_at: string;
  updated_at: string;
}

/** Payload da API e-SUS Notifica para dengue/chikungunya/zika */
export interface ESUSNotificaPayload {
  /** Código IBGE do município (7 dígitos) */
  codigoMunicipio: string;
  /** CNES da unidade de saúde notificante */
  codigoCnes: string;
  /** Data da notificação ISO (YYYY-MM-DD) */
  dataNotificacao: string;
  /** Semana epidemiológica */
  semanaEpidemiologica: number;
  /** Agravo notificado */
  agravo: 'A90' | 'A92.0' | 'A92.8';  // CID-10: A90=dengue, A92.0=chikungunya, A92.8=zika
  /** Status do caso */
  classificacaoFinal: 1 | 2 | 3 | 5 | 6;
  /** 1=lab 2=clínico-epi */
  criterioConfirmacao: 1 | 2;
  /** Endereço (logradouro + número) */
  logradouro?: string;
  /** Bairro de residência */
  bairro?: string;
  /** Latitude decimal */
  latitude?: number;
  /** Longitude decimal */
  longitude?: number;
  /** Observações livres */
  observacao?: string;
}

export const AGRAVO_CID: Record<TipoAgravoESUS, string> = {
  dengue:        'A90',
  chikungunya:   'A92.0',
  zika:          'A92.8',
  suspeito:      'A90',  // Usa dengue como padrão para suspeito
};

export const AGRAVO_LABELS: Record<TipoAgravoESUS, string> = {
  dengue:      'Dengue',
  chikungunya: 'Chikungunya',
  zika:        'Zika',
  suspeito:    'Suspeito (dengue)',
};

// ── MÓDULO 1 — LIRAa ─────────────────────────────────────────────────────────

export interface LiraaResultado {
  ciclo: number;
  total_imoveis: number;
  inspecionados: number;
  fechados: number;
  iip: number;
  ib: number;
  imoveis_com_foco: number;
  total_recipientes_foco: number;
  classificacao_risco: 'satisfatório' | 'alerta' | 'risco';
  por_deposito: {
    tipo: string;
    inspecionados: number;
    com_foco: number;
    indice: number;
  }[];
  // ── dados de focos_risco (AUX-4) ────────────────────────────────────────────
  focos_detectados_drone: number;
  focos_confirmados: number;
  focos_resolvidos: number;
  focos_descartados: number;
  taxa_resolucao_focos_pct: number;
  focos_por_prioridade: Record<FocoRiscoPrioridade, number>;
}

// ── MÓDULO 2 — Produtividade de Agentes ──────────────────────────────────────

export interface AgenteProdutividade {
  agente_id: string;
  agente_nome: string;
  visitas: number;
  com_acesso: number;
  sem_acesso: number;
  taxa_acesso_pct: number;
  focos: number;
  usou_larvicida: number;
  media_dia: number | null;
}

// ── MÓDULO 4 — Score Preditivo de Surto ──────────────────────────────────────

export interface ScoreSurtoRegiao {
  regiao_id: string;
  regiao_nome: string;
  score_total: number;
  contrib_pluvio: number;
  contrib_recorrencia: number;
  contrib_casos_14d: number;
  contrib_sla_vencido: number;
}

// ── MÓDULO 6 — Correlação Vistoria × Drone ───────────────────────────────────

export interface VistoriaDroneCorrelacao {
  id: string;
  vistoria_id: string;
  levantamento_item_id: string;
  cliente_id: string;
  distancia_metros: number;
  drone_detectou_foco: boolean;
  campo_confirmou_foco: boolean | null;
  created_at: string;
}

export interface YoloQualidadeResumo {
  precisao_estimada: number;
  taxa_falsos_positivos: number;
  total_correlacoes: number;
  cobertura: number;
  evolucao_mensal: { mes: string; precisao: number }[];
  correlacoes: {
    id: string;
    endereco: string;
    risco_drone: string;
    confirmado_campo: boolean | null;
    distancia_metros: number;
  }[];
}

export interface AlertaRetornoImovel {
  id: string;
  cliente_id: string;
  imovel_id: string;
  agente_id: string;
  ciclo: number;
  vistoria_id: string | null;
  motivo: string;
  retorno_em: string;
  resolvido: boolean;
  resolvido_em: string | null;
  created_at: string;
  imovel?: { numero: string | null; logradouro: string | null; bairro: string | null } | null;
}

export interface Quarteirao {
  id: string;
  cliente_id: string;
  regiao_id: string | null;
  codigo: string;
  bairro: string | null;
  ativo: boolean;
  created_at: string;
}

export interface DistribuicaoQuarteirao {
  id: string;
  cliente_id: string;
  ciclo: number;
  quarteirao: string;
  agente_id: string;
  regiao_id: string | null;
  created_at: string;
  updated_at: string;
  /** Populado via join — presente ao usar listByCiclo com join de agentes */
  agente_nome?: string;
}

export interface CoberturaQuarteirao {
  quarteirao: string;
  bairro: string | null;
  agente_id: string;
  total_imoveis: number;
  visitados: number;
  pct_cobertura: number;
}

export interface ConsumoLarvicida {
  agente_id: string;
  agente_nome: string;
  total_larvicida_g: number;
  total_vistorias: number;
  depositos_tratados: number;
  por_tipo: Record<string, number>;
}

// ── Aggregate Root: focos_risco ───────────────────────────────────────────────

export type FocoRiscoStatus =
  | 'suspeita'
  | 'em_triagem'
  | 'aguarda_inspecao'
  | 'em_inspecao'
  | 'confirmado'
  | 'em_tratamento'
  | 'resolvido'
  | 'descartado';

export type FocoRiscoOrigem = 'drone' | 'agente' | 'cidadao' | 'pluvio' | 'manual';

export type FocoRiscoPrioridade = 'P1' | 'P2' | 'P3' | 'P4' | 'P5';

export interface FocoRisco {
  id: string;
  cliente_id: string;
  imovel_id: string | null;
  regiao_id: string | null;
  origem_tipo: FocoRiscoOrigem;
  origem_levantamento_item_id: string | null;
  origem_vistoria_id: string | null;
  status: FocoRiscoStatus;
  /** GAP P1: Natureza do item na entrada. Independente do status operacional. */
  classificacao_inicial: FocoRiscoClassificacao;
  prioridade: FocoRiscoPrioridade | null;
  ciclo: number | null;
  latitude: number | null;
  longitude: number | null;
  /** Único campo texto de endereço nesta tabela. Derivado de imoveis quando imovel_id existir. */
  endereco_normalizado: string | null;
  suspeita_em: string;
  /** Preenchido automaticamente pelo trigger ao transicionar para 'confirmado'. */
  confirmado_em: string | null;
  /** Preenchido automaticamente pelo trigger ao transicionar para 'resolvido'. */
  resolvido_em: string | null;
  responsavel_id: string | null;
  desfecho: string | null;
  /** Preenchido quando este foco representa recorrência no mesmo imóvel. */
  foco_anterior_id: string | null;
  /** Array de caso_notificado.id próximos (raio 300m). Mantido por trigger. */
  casos_ids: string[];
  created_at: string;
  updated_at: string;
  /** M07: Usuário que criou o foco. Preenchido por trigger BEFORE INSERT. */
  created_by: string | null;
  /** Observação livre do agente sobre o atendimento. Migration 20260923. */
  observacao?: string | null;
  /** QW-10A: Soft delete. Null = ativo. */
  deleted_at?: string | null;
  deleted_by?: string | null;
  /** GAP P1 dados mínimos: timestamp da 1ª vez que o foco ficou completo. */
  dados_minimos_em?: string | null;
  /** Timestamp do início formal da inspeção de campo (transição para em_inspecao). */
  inspecao_em?: string | null;
  /** Score inteiro de prioridade calculado (SLA+reincidência+casos próximos). 20261019. */
  score_prioridade: number;
  /** Identificador legível no formato YYYY-NNNNNNNN. Gerado automaticamente. 20270101. */
  codigo_foco?: string | null;
}

export interface FocoRiscoHistorico {
  id: string;
  foco_risco_id: string;
  cliente_id: string;
  status_anterior: FocoRiscoStatus | null;
  /** Null para eventos tipo 'classificacao_alterada'. */
  status_novo: FocoRiscoStatus | null;
  alterado_por: string | null;
  motivo: string | null;
  alterado_em: string;
  tipo_evento?: 'transicao_status' | 'classificacao_alterada' | 'dados_minimos_completos' | 'inspecao_iniciada';
  classificacao_anterior?: string | null;
  classificacao_nova?: string | null;
}

/** Cache de respostas geradas por IA (tabela ia_insights). */
export interface IaInsight {
  id: string;
  cliente_id: string;
  tipo: string;
  texto: string;
  payload: Record<string, unknown>;
  modelo: string;
  tokens_in: number | null;
  tokens_out: number | null;
  valido_ate: string;
  created_at: string;
}

/** Retorno da view v_focos_risco_ativos — inclui campos JOIN de imovel, região, SLA. */
export interface FocoRiscoAtivo extends FocoRisco {
  // imovel (JOIN)
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  quarteirao: string | null;
  tipo_imovel: string | null;
  // região (JOIN)
  regiao_nome: string | null;
  // responsável (JOIN)
  responsavel_nome: string | null;
  // SLA (JOIN)
  sla_prazo_em: string | null;
  sla_violado: boolean | null;
  sla_status: 'ok' | 'atencao' | 'critico' | 'vencido' | 'sem_sla';
  // levantamento_item de origem (JOIN)
  origem_image_url: string | null;
  origem_item: string | null;
  // GAP P1 dados mínimos (computed inline na view)
  tem_dados_minimos: boolean;
  pendencias: string[];
  // SLA Inteligente — Fase A (v_focos_risco_ativos)
  fase_sla: 'triagem' | 'inspecao' | 'confirmacao' | 'tratamento' | 'encerrado' | null;
  tempo_em_estado_atual_min: number | null;
  prazo_fase_min: number | null;
  status_sla_inteligente: 'ok' | 'atencao' | 'critico' | 'vencido' | 'sem_prazo' | 'encerrado' | null;
}

/** Tipo do agrupamento territorial de focos (hierarquia: quadra > bairro > regiao > item). */
export type FocoAgrupadorTipo = 'quadra' | 'bairro' | 'regiao' | 'item';

/** Retorno da view v_focos_risco_agrupados — agrupamento territorial para triagem. */
export interface FocoRiscoAgrupado {
  cliente_id: string;
  agrupador_tipo: FocoAgrupadorTipo;
  agrupador_valor: string;
  quantidade_focos: number;
  /** Focos em em_triagem ou aguarda_inspecao — elegíveis para distribuição. */
  quantidade_elegivel: number;
  ct_em_triagem: number;
  ct_aguarda_inspecao: number;
  /** Focos sem responsável atribuído no grupo. */
  ct_sem_responsavel: number;
  /** Ordinal da maior prioridade do grupo: 1=P1 … 5=P5. 99=sem prioridade. */
  prioridade_max_ord: number | null;
  /** IDs dos focos do grupo, ordenados por score_prioridade desc. */
  foco_ids: string[];
  lat_media: number | null;
  lng_media: number | null;
}

/** Filtros para useFocosRisco. */
export interface FocoRiscoFiltros {
  status?: FocoRiscoStatus[];
  regiao_id?: string;
  ciclo?: number;
  prioridade?: FocoRiscoPrioridade[];
  origem_tipo?: FocoRiscoOrigem;
  classificacao_inicial?: FocoRiscoClassificacao;
  imovel_id?: string;
  responsavel_id?: string;
  semResponsavel?: boolean;
  de?: Date;
  ate?: Date;
  page?: number;
  pageSize?: number;
  /** Ordenação da listagem. Padrão: suspeita_em_desc (mais recentes primeiro). */
  orderBy?: 'suspeita_em_asc' | 'suspeita_em_desc' | 'score_prioridade_desc';
}

/**
 * Transições permitidas a partir de cada estado (validação client-side).
 *
 * Fluxo canônico:
 *   suspeita ──(auto-trigger)──► em_triagem
 *   em_triagem ──(supervisor via rpc_atribuir_agente_foco)──► aguarda_inspecao
 *   aguarda_inspecao ──(agente/auto-vistoria)──► em_inspecao
 *   aguarda_inspecao ──(agente)──► descartado
 *   em_inspecao ──(agente)──► confirmado | descartado
 *   confirmado ──(agente)──► em_tratamento
 *   em_tratamento ──(agente)──► resolvido | descartado
 */
export const TRANSICOES_PERMITIDAS: Record<FocoRiscoStatus, FocoRiscoStatus[]> = {
  suspeita:          [],                           // auto-triagem via trigger; nenhuma transição manual
  em_triagem:        ['aguarda_inspecao'],               // descartado removido: supervisor não descarta
  aguarda_inspecao:  ['em_inspecao', 'descartado'],
  em_inspecao:       ['confirmado', 'descartado'],
  confirmado:        ['em_tratamento'],            // obrigatório passar por em_tratamento
  em_tratamento:     ['resolvido', 'descartado'],
  resolvido:         [],
  descartado:        [],
};

export function getTransicoesPermitidas(status: FocoRiscoStatus): FocoRiscoStatus[] {
  return TRANSICOES_PERMITIDAS[status] ?? [];
}

export type FocoRiscoClassificacao =
  | 'suspeito'
  | 'risco'
  | 'foco'
  | 'caso_notificado';

export const LABEL_CLASSIFICACAO_INICIAL: Record<FocoRiscoClassificacao, string> = {
  suspeito:        'Suspeito',
  risco:           'Risco ambiental',
  foco:            'Foco confirmável',
  caso_notificado: 'Caso notificado',
};

/** Classes Tailwind por classificação — usar em ClassificacaoBadge. */
export const COR_CLASSIFICACAO_INICIAL: Record<FocoRiscoClassificacao, string> = {
  suspeito:        'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  risco:           'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  foco:            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  caso_notificado: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

export type FocoRiscoTimelineTipo =
  | 'deteccao'
  | 'estado'
  | 'classificacao_alterada'
  | 'dados_minimos_completos'
  | 'inspecao_iniciada'
  | 'vistoria'
  | 'vistoria_campo'
  | 'acao'
  | 'sla'
  | 'caso_notificado'
  | 'reinspecao';

/** Detalhamento de dados mínimos por foco — view v_focos_dados_minimos_status. */
export interface FocoDadosMinimosStatus {
  foco_id: string;
  cliente_id: string;
  tem_localizacao: boolean;
  tem_bairro: boolean;
  tem_classificacao: boolean;
  tem_descricao: boolean;
  tem_evidencia: boolean;
  tem_dados_minimos: boolean;
  pendencias: string[];
  dados_minimos_em: string | null;
}

/** Linha unificada da view v_foco_risco_timeline. */
export interface FocoRiscoTimelineItem {
  foco_risco_id: string;
  tipo: FocoRiscoTimelineTipo;
  /** Timestamp do evento — ordenar DESC. */
  ts: string | null;
  titulo: string;
  descricao: string | null;
  ator_id: string | null;
  ref_id: string | null;
}

/** Retorno da view v_focos_risco_analytics — inclui campos calculados. */
export interface FocoRiscoAnalytics extends FocoRisco {
  regiao_nome: string | null;
  /** Horas entre suspeita_em e resolvido_em. Null se não resolvido. */
  tempo_total_horas: number | null;
  /** Resolvido dentro do prazo SLA. Null se sem SLA ou não resolvido. */
  sla_cumprido: boolean | null;
  /** Horas utilizadas do SLA (inicio → resolvido_em). */
  sla_horas_utilizadas: number | null;
  sla_prazo_em: string | null;
  sla_violado: boolean | null;
  sla_prioridade: string | null;
  eh_reincidencia: boolean;
  total_focos_no_imovel: number;
  total_casos_proximos: number | null;
}

/** Item do resultado de rpc_resumo_regional. */
export interface ResumoRegional {
  regiao_id: string | null;
  regiao_nome: string | null;
  total_focos: number;
  focos_resolvidos: number;
  focos_ativos: number;
  focos_descartados: number;
  taxa_falso_positivo_drone: number;
  media_tempo_tratamento_horas: number | null;
  sla_violado_count: number;
}

// ── GAP P0: Reinspeção Programada Pós-Tratamento ──────────────────────────────

export type ReinspecaoStatus = 'pendente' | 'realizada' | 'cancelada' | 'vencida';
export type ReinspecaoTipo   = 'eficacia_pos_tratamento' | 'retorno_operacional';
export type ReinspecaoResultado = 'resolvido' | 'persiste' | 'nao_realizado';

export const LABEL_REINSPECAO_STATUS: Record<ReinspecaoStatus, string> = {
  pendente:  'Pendente',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
  vencida:   'Vencida',
};

export const LABEL_REINSPECAO_TIPO: Record<ReinspecaoTipo, string> = {
  eficacia_pos_tratamento: 'Eficácia pós-tratamento',
  retorno_operacional:     'Retorno operacional',
};

export const LABEL_REINSPECAO_RESULTADO: Record<ReinspecaoResultado, string> = {
  resolvido:     'Problema resolvido',
  persiste:      'Problema persiste',
  nao_realizado: 'Não realizado',
};

export interface ReinspecaoProgramada {
  id: string;
  cliente_id: string;
  foco_risco_id: string;
  status: ReinspecaoStatus;
  tipo: ReinspecaoTipo;
  /** 'automatico' = criado por trigger; 'manual' = criado pelo supervisor */
  origem: 'automatico' | 'manual';
  data_prevista: string;
  data_realizada: string | null;
  responsavel_id: string | null;
  observacao: string | null;
  resultado: ReinspecaoResultado | null;
  criado_por: string | null;
  cancelado_por: string | null;
  motivo_cancelamento: string | null;
  created_at: string;
  updated_at: string;
}

/** ReinspecaoProgramada com campos JOIN (responsavel_nome, foco endereço) */
export interface ReinspecaoComFoco extends ReinspecaoProgramada {
  responsavel_nome: string | null;
  foco_endereco: string | null;
  foco_bairro: string | null;
  foco_prioridade: string | null;
  foco_status: string | null;
}

// ── QW-13: Fila de jobs assíncronos ──────────────────────────────────────────

export type JobStatus = 'pendente' | 'em_execucao' | 'concluido' | 'falhou' | 'cancelado';

export type JobTipo =
  | 'triagem_ia'
  | 'relatorio_semanal'
  | 'cnes_sync'
  | 'limpeza_retencao'
  | 'cloudinary_cleanup'
  | 'health_check';

/** Job na fila de processamento assíncrono (tabela job_queue). */
export interface JobQueue {
  id: string;
  tipo: JobTipo;
  payload: Record<string, unknown>;
  status: JobStatus;
  tentativas: number;
  max_tentativas: number;
  executar_em: string;
  iniciado_em: string | null;
  concluido_em: string | null;
  resultado: Record<string, unknown> | null;
  erro: string | null;
  criado_em: string;
  updated_at: string;
}

// ── QW-12: Monitoramento externo / Health checks ───────────────────────────

export type SystemHealthStatus = 'ok' | 'erro' | 'aviso';
export type SystemAlertNivel = 'info' | 'warning' | 'critical';

/** Registro de verificação de health check por serviço (tabela system_health_log). */
export interface SystemHealthLog {
  id: string;
  servico: string;
  status: SystemHealthStatus;
  detalhes: Record<string, unknown> | null;
  criado_em: string;
}

/** Alerta operacional gerado pelo health-check (tabela system_alerts). */
export interface SystemAlert {
  id: string;
  servico: string;
  nivel: SystemAlertNivel;
  mensagem: string;
  resolvido: boolean;
  resolvido_em: string | null;
  criado_em: string;
}

// ── P7.7 — Observabilidade Operacional do Piloto ──────────────────────────────

/** Funil operacional do dia — view v_piloto_funil_hoje */
export interface PilotoFunilHoje {
  cliente_id: string;
  entradas_hoje: number;
  entradas_7d: number;
  em_triagem_agora: number;
  aguarda_inspecao_agora: number;
  em_inspecao_agora: number;
  em_tratamento_agora: number;
  ativos_total: number;
  resolvidos_hoje: number;
  resolvidos_7d: number;
  despachados_hoje: number;
  despachados_7d: number;
  sem_responsavel_em_triagem: number;
  envelhecidos_24h: number;
  aguardando_envelhecidos_48h: number;
  foco_mais_antigo_em: string | null;
  tempo_medio_triagem_7d_horas: number | null;
  tempo_medio_suspeita_inspecao_7d_horas: number | null;
  entradas_por_origem_hoje: {
    drone: number;
    cidadao: number;
    agente: number;
    manual: number;
    pluvio: number;
  };
}

/** Despacho por supervisor — view v_piloto_despachos_supervisor */
export interface PilotoDespachoSupervisor {
  cliente_id: string;
  supervisor_id: string | null;
  supervisor_nome: string | null;
  despachados_hoje: number;
  despachados_7d: number;
  despachados_total: number;
  tempo_medio_triagem_7d_horas: number | null;
}

/** Produtividade de agente em campo — view v_piloto_prod_agentes */
export interface PilotoProdAgente {
  cliente_id: string;
  agente_id: string;
  agente_nome: string | null;
  atribuidos_ativos: number;
  aguardando: number;
  em_inspecao: number;
  iniciados_total: number;
  iniciados_hoje: number;
  resolvidos_total: number;
  resolvidos_hoje: number;
  envelhecidos: number;
  tempo_medio_despacho_inspecao_horas: number | null;
}
