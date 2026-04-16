import { z } from 'zod';
import { PapelAppEnum } from './enums';

// ── Login ─────────────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
export type LoginBody = z.infer<typeof loginSchema>;

export const loginResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

// ── Refresh ───────────────────────────────────────────
export const refreshSchema = z.object({
  refresh_token: z.string(),
});
export type RefreshBody = z.infer<typeof refreshSchema>;

// ── Auth Me (GET /auth/me) ────────────────────────────
export const authMeResponseSchema = z.object({
  id: z.string().uuid(),
  authId: z.string().uuid(),
  email: z.string().email(),
  nome: z.string(),
  clienteId: z.string().uuid().nullable(),
  papeis: z.array(PapelAppEnum),
});
export type AuthMeResponse = z.infer<typeof authMeResponseSchema>;
