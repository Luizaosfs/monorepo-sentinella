import { z } from 'zod';

// ── Papel do usuário ──────────────────────────────────
export const PapelAppEnum = z.enum([
  'admin',
  'supervisor',
  'agente',
  'notificador',
  'analista_regional',
]);
export type PapelApp = z.infer<typeof PapelAppEnum>;

// ── Status do foco de risco ───────────────────────────
export const FocoRiscoStatusEnum = z.enum([
  'suspeita',
  'em_triagem',
  'aguarda_inspecao',
  'em_inspecao',
  'confirmado',
  'em_tratamento',
  'resolvido',
  'descartado',
]);
export type FocoRiscoStatus = z.infer<typeof FocoRiscoStatusEnum>;

// ── Prioridade do foco ────────────────────────────────
export const FocoPrioridadeEnum = z.enum(['P1', 'P2', 'P3', 'P4', 'P5']);
export type FocoPrioridade = z.infer<typeof FocoPrioridadeEnum>;

// ── Tipo de imóvel ────────────────────────────────────
export const TipoImovelEnum = z.enum([
  'residencial',
  'comercial',
  'terreno',
  'ponto_estrategico',
]);
export type TipoImovel = z.infer<typeof TipoImovelEnum>;

// ── Tenant status ─────────────────────────────────────
export const TenantStatusEnum = z.enum([
  'ativo',
  'trial',
  'suspenso',
  'cancelado',
  'inadimplente',
]);
export type TenantStatus = z.infer<typeof TenantStatusEnum>;
