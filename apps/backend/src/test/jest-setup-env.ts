/**
 * Garante variáveis mínimas para importar módulos que validam `env` (Zod) e Prisma em testes.
 * Sobrescreva com `.env` ou variáveis reais no ambiente local/CI quando necessário.
 */
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    'postgresql://test:test@127.0.0.1:5432/sentinella_test?schema=public';
}
if (!process.env.SECRET_JWT) {
  process.env.SECRET_JWT = 'test-secret-jwt-key-minimum-32-characters!!';
}
process.env.NODE_ENV ??= 'test';
