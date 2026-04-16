/**
 * @sentinella/contracts
 *
 * Contratos Zod compartilhados entre frontend (@sentinella/frontend)
 * e backend (@sentinella/backend).
 *
 * Exportar aqui: schemas Zod, tipos inferidos, enums de domínio.
 * NÃO exportar: lógica de negócio, código de runtime específico de plataforma.
 *
 * Uso futuro:
 *   import { loginSchema, type LoginBody } from '@sentinella/contracts'
 */

// ── Auth ──────────────────────────────────────────────
export * from './auth';

// ── Domínio ───────────────────────────────────────────
export * from './enums';
