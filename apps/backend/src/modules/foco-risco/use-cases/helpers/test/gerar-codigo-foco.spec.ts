import { gerarCodigoFoco } from '../gerar-codigo-foco';

function makePrisma(ultimoSeq: number | bigint) {
  return {
    client: {
      $queryRaw: jest.fn().mockResolvedValue([{ ultimo: BigInt(ultimoSeq) }]),
    },
  } as any;
}

const CLIENTE_ID = '00000000-0000-4000-8000-000000000001';

describe('gerarCodigoFoco', () => {
  it('gera código no formato YYYY-NNNNNNNN', async () => {
    const prisma = makePrisma(1);
    const codigo = await gerarCodigoFoco(prisma, CLIENTE_ID, new Date('2026-04-25T00:00:00Z'));

    expect(codigo).toMatch(/^\d{4}-\d{8}$/);
  });

  it('padding de 8 zeros: seq=1 → 00000001', async () => {
    const prisma = makePrisma(1);
    const codigo = await gerarCodigoFoco(prisma, CLIENTE_ID, new Date('2026-01-01T00:00:00Z'));

    expect(codigo).toBe('2026-00000001');
  });

  it('padding correto para seq=12345 → 00012345', async () => {
    const prisma = makePrisma(12345);
    const codigo = await gerarCodigoFoco(prisma, CLIENTE_ID, new Date('2026-01-01T00:00:00Z'));

    expect(codigo).toBe('2026-00012345');
  });

  it('usa o ano do parâmetro data', async () => {
    const prisma = makePrisma(1);
    const codigo = await gerarCodigoFoco(prisma, CLIENTE_ID, new Date('2025-06-15T00:00:00Z'));

    expect(codigo.startsWith('2025-')).toBe(true);
  });

  it('default data = ano atual (UTC)', async () => {
    const prisma = makePrisma(1);
    const anoAtual = new Date().getUTCFullYear().toString();
    const codigo = await gerarCodigoFoco(prisma, CLIENTE_ID);

    expect(codigo.startsWith(`${anoAtual}-`)).toBe(true);
  });

  it('chamadas sequenciais: mock incrementa seq → números distintos', async () => {
    const prisma = {
      client: {
        $queryRaw: jest
          .fn()
          .mockResolvedValueOnce([{ ultimo: BigInt(1) }])
          .mockResolvedValueOnce([{ ultimo: BigInt(2) }]),
      },
    } as any;

    const c1 = await gerarCodigoFoco(prisma, CLIENTE_ID, new Date('2026-01-01T00:00:00Z'));
    const c2 = await gerarCodigoFoco(prisma, CLIENTE_ID, new Date('2026-01-01T00:00:00Z'));

    expect(c1).toBe('2026-00000001');
    expect(c2).toBe('2026-00000002');
    expect(c1).not.toBe(c2);
  });
});
