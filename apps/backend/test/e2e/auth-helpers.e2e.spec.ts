import { JwtService } from '@nestjs/jwt';

import { AGENTE_AUTH_ID, signTokenFor } from './auth-helpers';

/**
 * Smoke do helper de autenticação — preparatório para Parte 2 (testes de
 * `/focos-risco/:id/inspecao`) e Parte 3 (`/denuncia-cidadao`).
 *
 * Não exercita endpoint real — só garante que o JWT gerado é decodificável
 * com os mesmos parâmetros que o `AuthGuard` espera (audience, issuer, sub).
 */
describe('auth-helpers (e2e smoke)', () => {
  it('signTokenFor gera JWT verificável com audience/issuer corretos', async () => {
    const token = signTokenFor(AGENTE_AUTH_ID);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);

    const jwt = new JwtService({ secret: process.env.SECRET_JWT! });
    const payload = await jwt.verifyAsync(token, {
      audience: 'sentinella-api',
      issuer: 'sentinella-auth',
    });
    expect(payload.sub).toBe(AGENTE_AUTH_ID);
  });
});
