import { JwtService } from '@nestjs/jwt';

export {
  ADMIN_AUTH_ID,
  ADMIN_USUARIO_ID,
  AGENTE_AUTH_ID,
  AGENTE_USUARIO_ID,
  E2E_CLIENTE_ID,
  E2E_CLIENTE_SLUG,
  INATIVO_AUTH_ID,
  INATIVO_USUARIO_ID,
  SUPERVISOR_AUTH_ID,
  SUPERVISOR_USUARIO_ID,
} from './seed';

/**
 * Gera JWT válido para o `AuthGuard` (audience/issuer compatíveis com
 * src/guards/auth.guard.ts). Usado pelos specs de Parte 2 e 3.
 *
 * @param authId  Mesmo valor de `usuarios.auth_id` (vai como `sub`).
 * @returns string compact JWT — incluir como Bearer token no header.
 */
export function signTokenFor(authId: string): string {
  const secret = process.env.SECRET_JWT;
  if (!secret) {
    throw new Error(
      'signTokenFor: SECRET_JWT ausente — globalSetup do e2e não rodou.',
    );
  }

  const jwt = new JwtService({ secret });
  return jwt.sign(
    { sub: authId },
    {
      audience: 'sentinella-api',
      issuer: 'sentinella-auth',
      expiresIn: '1h',
    },
  );
}
