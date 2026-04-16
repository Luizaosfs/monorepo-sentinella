import { z } from 'zod';

/**
 * Convenções de coerção Zod alinhadas ao **mf-api-finance** (ManFrota) para migração Sentinella.
 *
 * Referência:
 * - Query numérico: `z.coerce.number()` — ex.: `filter-bank.input.ts`, `filter-finance.input.ts`
 * - Data em body (string ISO → Date, vazio → undefined): `save-finance.body.ts`, `create-bank.body.ts`
 * - Boolean em query (string `"true"` / `"false"`): `filter-finance.input.ts` (`deleted`)
 *
 * No Swagger, prefira `.describe('...')` nos DTOs finais (padrão já usado em Sentinella).
 */

/** Query/body: inteiro opcional (HTTP envia string). */
export function coerceOptionalInt(description?: string) {
  const s = z.coerce.number().int().optional();
  return description ? s.describe(description) : s;
}

/** Query/body: inteiro obrigatório. */
export function coerceInt(description?: string) {
  const s = z.coerce.number().int();
  return description ? s.describe(description) : s;
}

/**
 * Data opcional — padrão **save-finance.body** / **filter-bank**:
 * aceita `Date` ou string; string vazia vira `undefined`.
 */
export function optionalDateFromString(description?: string) {
  const schema = z.preprocess((val: unknown) => {
    if (val === undefined || val === null || val === '') return undefined;
    if (val instanceof Date) return val;
    const s = String(val).trim();
    if (!s) return undefined;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }, z.date().optional());

  return description ? schema.describe(description) : schema;
}

/**
 * Data obrigatória (body/query) — equivalente ao uso de `z.coerce.date()` em Sentinella.
 */
export function coerceRequiredDate(params?: { description?: string; requiredError?: string }) {
  const s = z.coerce.date({
    required_error: params?.requiredError ?? 'Data obrigatória',
    invalid_type_error: 'Data inválida',
  });
  return params?.description ? s.describe(params.description) : s;
}

/**
 * Boolean em **query** — padrão **filter-finance** (`deleted`):
 * só `"true"` vira `true`; ausente ou outro valor → `false` ou `undefined` conforme optional.
 */
export function optionalQueryBooleanTrueOnly(description?: string) {
  const schema = z
    .string()
    .transform((value) => value === 'true')
    .pipe(z.boolean())
    .optional();

  return description ? schema.describe(description) : schema;
}

/**
 * Boolean de query/body com coerção nativa do Zod (`"true"`/`"false"`, 0/1 em alguns casos).
 * Preferido em Sentinella quando o cliente já envia boolean JSON ou query padronizada.
 */
export function coerceOptionalBoolean(description?: string) {
  const base = z.coerce.boolean().optional();
  return description ? base.describe(description) : base;
}

/**
 * Número opcional em body/query (string JSON → number), padrão `z.coerce.number()` ManFrota.
 */
export function coerceOptionalNumber(description?: string) {
  const s = z.coerce.number().optional();
  return description ? s.describe(description) : s;
}

/**
 * Objeto JSON genérico — substitui `z.record(z.any())` (valores: `unknown`).
 */
export function jsonRecordOptional(description?: string) {
  const s = z.record(z.string(), z.unknown()).optional();
  return description ? s.describe(description) : s;
}

/**
 * Objeto JSON obrigatório — `Record<string, unknown>`.
 */
export function jsonRecordRequired(description?: string) {
  const s = z.record(z.string(), z.unknown());
  return description ? s.describe(description) : s;
}

/**
 * Record com valores numéricos (ex.: mapas `string → number`).
 */
export function numberRecordOptional(description?: string) {
  const s = z.record(z.string(), z.number()).optional();
  return description ? s.describe(description) : s;
}

/**
 * Paginação: inteiro positivo com fallback (substitui `.any().transform(Number)`).
 */
export function positiveIntWithFallback(fallback: number, opts?: { max?: number; description?: string }) {
  const max = opts?.max;
  const schema = z.preprocess((val: unknown) => {
    if (val === undefined || val === null || val === '') return fallback;
    const n = Number(val);
    if (!Number.isFinite(n)) return fallback;
    let i = Math.trunc(n);
    if (i < 1) i = 1;
    if (max !== undefined && i > max) i = max;
    return i;
  }, z.number().int());

  return opts?.description ? schema.describe(opts.description) : schema;
}
