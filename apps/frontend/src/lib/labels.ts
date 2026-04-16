// src/lib/labels.ts
import { LABEL_STATUS as _LABEL_STATUS_FOCO } from '@/types/focoRisco';

/**
 * PAPÉIS CANÔNICOS DO SISTEMA (fonte: enum `papel_app` no banco + `PapelApp` em database.ts)
 *
 *   admin       — dono do SaaS, acesso cross-tenant; sem cliente_id
 *   supervisor  — gestor da prefeitura; com cliente_id
 *   agente      — agente de campo; com cliente_id
 *   notificador — funcionário UBS/posto de saúde; com cliente_id
 *
 * Legado aceito somente para exibição (dados pré-migration 20261015000001):
 *   'operador'  → exibido como agente
 *
 * Aliases de UI que NUNCA existiram no enum (nunca usar em auth/guards):
 *   'gestor'    → alias de display para supervisor
 */

/** Label longo — usado em perfil, header, tooltip */
export const PAPEL_LABEL: Record<string, string> = {
  admin:       'Administrador da Plataforma',
  supervisor:  'Supervisor Municipal',
  agente:      'Agente de Endemias',
  operador:    'Agente de Endemias',    // legado pré-migration
  notificador: 'Notificador (UBS)',
};

/** Label curto — usado em badges e tabelas */
export const PAPEL_LABEL_CURTO: Record<string, string> = {
  admin:       'Admin',
  supervisor:  'Supervisor',
  agente:      'Agente',
  operador:    'Agente',                // legado pré-migration
  notificador: 'Notificador',
};

export function getPapelLabel(papel: string | null | undefined, curto = false): string {
  if (!papel) return '—';
  const mapa = curto ? PAPEL_LABEL_CURTO : PAPEL_LABEL;
  return mapa[papel.toLowerCase()] ?? papel;
}

// Função EXCLUSIVA de exibição (UI)
// NÃO deve ser usada para autenticação ou regras de negócio
// Para auth usar normalizePapel de useAuth.tsx
/**
 * Normaliza um papel raw para o valor de domínio usado na UI.
 * Suporta apenas os papéis canônicos + legados aceitos.
 * 'gestor' nunca existiu no enum — alias de display para supervisor.
 * Use esta função em componentes de display — nunca em guards ou filtros de API.
 */
export function normalizarPapelParaExibicao(papel: string | null | undefined): string {
  if (!papel) return 'agente';
  const p = papel.toLowerCase().trim();
  if (p === 'admin') return 'admin';
  if (p === 'supervisor') return 'supervisor';
  if (p === 'notificador') return 'notificador';
  if (p === 'agente' || p === 'operador') return 'agente'; // operador: legado pré-migration
  if (p === 'analista_regional') return 'analista_regional';
  return 'agente';
}

/**
 * Labels de status de focos_risco.
 * Fonte canônica: LABEL_STATUS em src/types/focoRisco.ts — não duplicar aqui.
 */
export const STATUS_FOCO_LABEL: Record<string, string> = _LABEL_STATUS_FOCO;

export const STATUS_VISTORIA_LABEL: Record<string, string> = {
  pendente:  'Pendente',
  visitado:  'Visitado',
  fechado:   'Fechado',
  revisita:  'Revisita',
};

/** Labels de status de levantamento_itens — fonte canônica */
export const STATUS_LEVANTAMENTO_LABEL: Record<string, string> = {
  pendente:       'Pendente',
  em_atendimento: 'Em atendimento',
  resolvido:      'Resolvido',
};

/** Labels de status de SLA — fonte canônica */
export const STATUS_SLA_LABEL: Record<string, string> = {
  pendente:       'Pendente',
  em_atendimento: 'Em Atendimento',
  concluido:      'Concluído',
  vencido:        'Vencido',
};

export const PRIORIDADE_LABEL: Record<string, string> = {
  'P1': 'P1 — Crítica (4h)',
  'P2': 'P2 — Alta (12h)',
  'P3': 'P3 — Média (24h)',
  'P4': 'P4 — Baixa (72h)',
  'P5': 'P5 — Monitoramento (72h)',
  'Crítica':      'P1 — Crítica',
  'Urgente':      'P1 — Urgente',
  'Alta':         'P2 — Alta',
  'Moderada':     'P3 — Média',
  'Média':        'P3 — Média',
  'Baixa':        'P4 — Baixa',
  'Monitoramento':'P5 — Monitoramento',
};

export function getPrioridadeLabel(prioridade: string | null | undefined): string {
  if (!prioridade) return '—';
  return PRIORIDADE_LABEL[prioridade] ?? prioridade;
}

export const ORIGEM_FOCO_LABEL: Record<string, string> = {
  drone:   'Drone (IA)',
  agente:  'Vistoria de campo',
  cidadao: 'Denúncia cidadã',
  pluvio:  'Análise pluviométrica',
  manual:  'Registro manual',
};
