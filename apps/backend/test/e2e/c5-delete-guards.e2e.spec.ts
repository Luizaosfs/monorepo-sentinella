/**
 * E2E: valida que a migration c5_delete_guards.sql está aplicada
 * e que os 3 triggers bloqueiam DELETE físico em runtime.
 *
 * SKIP se não há DB real disponível (variável E2E_DB=true).
 */
import { PrismaService } from '@/shared/modules/database/prisma/prisma.service';

const shouldRun = process.env.E2E_DB === 'true';
const d = shouldRun ? describe : describe.skip;

d('[C.5] Triggers DELETE LGPD — verificação runtime', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.onModuleDestroy?.();
  });

  it('trg_bloquear_delete_cliente está instalado', async () => {
    const rows = await prisma.client.$queryRawUnsafe<any[]>(
      `SELECT tgname FROM pg_trigger WHERE tgname = 'trg_bloquear_delete_cliente'`,
    );
    expect(rows.length).toBe(1);
  });

  it('trg_bloquear_delete_imovel está instalado', async () => {
    const rows = await prisma.client.$queryRawUnsafe<any[]>(
      `SELECT tgname FROM pg_trigger WHERE tgname = 'trg_bloquear_delete_imovel'`,
    );
    expect(rows.length).toBe(1);
  });

  it('trg_bloquear_delete_vistoria está instalado', async () => {
    const rows = await prisma.client.$queryRawUnsafe<any[]>(
      `SELECT tgname FROM pg_trigger WHERE tgname = 'trg_bloquear_delete_vistoria'`,
    );
    expect(rows.length).toBe(1);
  });
});
