import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { config as loadDotenv } from 'dotenv';

/**
 * Jest globalSetup — roda UMA vez antes da suíte e2e.
 * Carrega .env.test, aplica schema Prisma no DB de teste, popula seed mínimo.
 */
export default async function globalSetup(): Promise<void> {
  const envPath = resolve(__dirname, '../../.env.test');
  if (!existsSync(envPath)) {
    throw new Error(
      `[e2e] .env.test ausente em ${envPath}.\n` +
        `Copie .env.test.example para .env.test e ajuste DATABASE_URL.`,
    );
  }
  loadDotenv({ path: envPath, override: true });

  if (!process.env.DATABASE_URL) {
    throw new Error('[e2e] DATABASE_URL não definida em .env.test');
  }
  if (!process.env.DATABASE_URL.includes('sentinella_test')) {
    throw new Error(
      `[e2e] DATABASE_URL não aponta para *_test (got "${process.env.DATABASE_URL}").\n` +
        `Recuso aplicar migrações em DB que não tenha "sentinella_test" no nome.`,
    );
  }

  // Sem migrations ativas em prisma/migrations/ (todas em _archive/).
  // Usamos `prisma db push` para aplicar o schema atual diretamente.
  // --accept-data-loss evita prompt interativo. Prisma 7 não tem
  // --skip-generate em db push (a flag deixou de existir).
  try {
    execSync(
      'npx prisma db push --schema ./prisma/schema --accept-data-loss',
      {
        cwd: resolve(__dirname, '../..'),
        stdio: 'inherit',
        env: { ...process.env },
      },
    );
  } catch (err) {
    throw new Error(
      `[e2e] prisma db push falhou. Verifique se o DB sentinella_test existe:\n` +
        `  createdb -U postgres sentinella_test\n` +
        `  psql -d sentinella_test -c "CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS pgcrypto;"\n` +
        `Erro original: ${(err as Error).message}`,
    );
  }

  // Seed mínimo (1 cliente + 3 usuários + 1 plano basico).
  // Prisma 7 exige adapter explícito — espelhamos o padrão de PrismaService.
  const { PrismaClient } = await import('@prisma/client');
  const { PrismaPg } = await import('@prisma/adapter-pg');
  const { Pool } = await import('pg');
  const { seedE2E } = await import('./seed');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({
    adapter: new PrismaPg(pool, { disposeExternalPool: true }),
  });
  try {
    await seedE2E(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
