/**
 * Substitui `Record<string, any>` no domínio.
 * Alinhado a DTOs Zod (`z.record(z.string(), z.unknown())`) e a campos `Json` no Prisma.
 */
export type JsonObject = Record<string, unknown>;
