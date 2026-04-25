import { PrismaLevantamentoReadRepository } from './prisma-levantamento-read.repository';

const makePrisma = (overrides: Record<string, any> = {}) => ({
  client: {
    levantamentos: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    levantamento_itens: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    levantamento_item_evidencias: { findMany: jest.fn().mockResolvedValue([]) },
    planejamento: { findFirst: jest.fn().mockResolvedValue(null) },
    sla_config: { findFirst: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn().mockResolvedValue([[], 0]),
    ...overrides,
  },
});

describe('PrismaLevantamentoReadRepository — soft-delete', () => {
  it('P3: findAll filtra deleted_at: null via buildWhere', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = makePrisma({ levantamentos: { findMany } as any });
    const repo = new PrismaLevantamentoReadRepository(prisma as any);

    await repo.findAll({} as any);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deleted_at: null }),
      }),
    );
  });

  it('P3: findItensByLevantamentoId filtra deleted_at: null em itens', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = makePrisma({ levantamento_itens: { findMany } as any });
    const repo = new PrismaLevantamentoReadRepository(prisma as any);

    await repo.findItensByLevantamentoId('lev-123');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deleted_at: null }),
      }),
    );
  });

  it('findItemById já filtra deleted_at: null (validação negativa — não regrediu)', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = makePrisma({ levantamento_itens: { findFirst } as any });
    const repo = new PrismaLevantamentoReadRepository(prisma as any);

    await repo.findItemById('item-id');

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deleted_at: null }),
      }),
    );
  });
});
