import { jsonRecordOptional, numberRecordOptional } from '@shared/dtos/zod-coercion';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// ── Policy header ─────────────────────────────────────────────────────────────

export const savePolicySchema = z.object({
  clienteId: z.string().uuid('clienteId inválido').optional(),
  name: z.string({ required_error: 'Nome obrigatório' }).min(1),
  version: z.string({ required_error: 'Versão obrigatória' }).min(1),
  isActive: z.boolean().default(false),
});

export class SaveRiskPolicyBody extends createZodDto(savePolicySchema) {}
export type SaveRiskPolicyInput = z.infer<typeof savePolicySchema>;

// ── Sub-table schemas ─────────────────────────────────────────────────────────

const defaultsSchema = z.object({
  chuvaRelevantemm: z.number(),
  diasLookupMax: z.number().int(),
  tendenciaDias: z.number().int(),
});

const fallbackRuleSchema = z.object({
  situacaoAmbiental: z.string(),
  probabilidadeLabel: z.string(),
  probabilidadePctMin: z.number(),
  probabilidadePctMax: z.number(),
  classificacao: z.string(),
  icone: z.string(),
  severity: z.number().int(),
});

const ruleSchema = z.object({
  idx: z.number().int(),
  chuvaMMMin: z.number(),
  chuvaMMMax: z.number(),
  diasMin: z.number().int(),
  diasMax: z.number().int(),
  situacaoAmbiental: z.string(),
  probabilidadeLabel: z.string(),
  probabilidadePctMin: z.number(),
  probabilidadePctMax: z.number(),
  classificacao: z.string(),
  icone: z.string(),
  severity: z.number().int(),
});

const binSchema = z.object({
  idx: z.number().int(),
  minVal: z.number(),
  maxVal: z.number(),
});

const factorSchema = z.object({
  idx: z.number().int(),
  minVal: z.number(),
  maxVal: z.number(),
  factor: z.number(),
});

const adjustPpSchema = z.object({
  idx: z.number().int(),
  minVal: z.number(),
  maxVal: z.number(),
  deltaPp: z.number(),
});

const tendenciaAdjustPpSchema = z.object({
  tendencia: z.enum(['crescente', 'estavel', 'decrescente']),
  deltaPp: z.number(),
});

// ── Full policy save ──────────────────────────────────────────────────────────

export const savePolicyFullSchema = z.object({
  name: z.string().min(1).optional(),
  version: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  defaults: defaultsSchema.optional(),
  fallbackRule: fallbackRuleSchema.optional(),
  rules: z.array(ruleSchema).optional(),
  binsSemChuva: z.array(binSchema).optional(),
  binsIntensidadeChuva: z.array(binSchema).optional(),
  binsPersistencia7d: z.array(binSchema).optional(),
  tempFactors: z.array(factorSchema).optional(),
  ventoFactors: z.array(factorSchema).optional(),
  tempAdjustPp: z.array(adjustPpSchema).optional(),
  ventoAdjustPp: z.array(adjustPpSchema).optional(),
  persistenciaAdjustPp: z.array(adjustPpSchema).optional(),
  tendenciaAdjustPp: z.array(tendenciaAdjustPpSchema).optional(),
});

export class SavePolicyFullBody extends createZodDto(savePolicyFullSchema) {}
export type SavePolicyFullInput = z.infer<typeof savePolicyFullSchema>;

// ── Drone / YOLO DTOs ─────────────────────────────────────────────────────────

export const saveDroneConfigSchema = z.object({
  baseByRisco: numberRecordOptional(),
  priorityThresholds: numberRecordOptional(),
  slaByPriorityHours: numberRecordOptional(),
  confidenceMultiplier: z.coerce.number().optional(),
  itemOverrides: jsonRecordOptional(
    'Overrides por item (estrutura livre, ex.: limites por classe)',
  ),
});

export class SaveDroneConfigBody extends createZodDto(saveDroneConfigSchema) {}
export type SaveDroneConfigInput = z.infer<typeof saveDroneConfigSchema>;

export const saveYoloClassSchema = z.object({
  id: z.string().uuid('id inválido'),
  item: z.string().optional(),
  risco: z.enum(['baixo', 'medio', 'alto']).optional(),
  peso: z.coerce.number().optional(),
  acao: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export class SaveYoloClassBody extends createZodDto(saveYoloClassSchema) {}
export type SaveYoloClassInput = z.infer<typeof saveYoloClassSchema>;

export const saveYoloSynonymSchema = z.object({
  clienteId: z.string().uuid().optional(),
  synonym: z.string({ required_error: 'Sinônimo obrigatório' }).min(1),
  mapsTo: z.string({ required_error: 'mapsTo obrigatório' }).min(1),
});

export class SaveYoloSynonymBody extends createZodDto(saveYoloSynonymSchema) {}
export type SaveYoloSynonymInput = z.infer<typeof saveYoloSynonymSchema>;
