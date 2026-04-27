import { PrismaVistoriaReadRepository } from './prisma-vistoria-read.repository';

const DELETED_AT_NULL = { where: { deleted_at: null } };

const makePrisma = (overrides: Record<string, any> = {}) => ({
  client: {
    vistorias: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    $transaction: jest.fn().mockResolvedValue([[], 0]),
    ...overrides,
  },
});

describe('PrismaVistoriaReadRepository — tenant isolation', () => {
  it('findByIdComDetalhes inclui depositos via include (não query direta)', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = makePrisma({ vistorias: { findFirst } as any });
    const repo = new PrismaVistoriaReadRepository(prisma as any);

    await repo.findByIdComDetalhes('vistoria-id');

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({ depositos: DELETED_AT_NULL }),
      }),
    );
  });

  it('findByIdComDetalhes inclui riscos via include', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = makePrisma({ vistorias: { findFirst } as any });
    const repo = new PrismaVistoriaReadRepository(prisma as any);

    await repo.findByIdComDetalhes('vistoria-id');

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({ riscos: DELETED_AT_NULL }),
      }),
    );
  });

  it('findByIdComDetalhes inclui sintomas via include', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = makePrisma({ vistorias: { findFirst } as any });
    const repo = new PrismaVistoriaReadRepository(prisma as any);

    await repo.findByIdComDetalhes('vistoria-id');

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({ sintomas: DELETED_AT_NULL }),
      }),
    );
  });

  it('findByIdComDetalhes inclui calhas via include', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = makePrisma({ vistorias: { findFirst } as any });
    const repo = new PrismaVistoriaReadRepository(prisma as any);

    await repo.findByIdComDetalhes('vistoria-id');

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({ calhas: DELETED_AT_NULL }),
      }),
    );
  });

  it('P2: findById filtra deleted_at: null', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = makePrisma({ vistorias: { findFirst } as any });
    const repo = new PrismaVistoriaReadRepository(prisma as any);

    await repo.findById('vistoria-id', null);

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deleted_at: null }),
      }),
    );
  });

  it('P2: findByIdComDetalhes filtra deleted_at: null', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = makePrisma({ vistorias: { findFirst } as any });
    const repo = new PrismaVistoriaReadRepository(prisma as any);

    await repo.findByIdComDetalhes('vistoria-id');

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deleted_at: null }),
      }),
    );
  });

  it('P2: findByIdIncludingDeleted usa findFirst sem filtro de deleted_at', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = makePrisma({ vistorias: { findFirst } as any });
    const repo = new PrismaVistoriaReadRepository(prisma as any);

    await repo.findByIdIncludingDeleted('vistoria-id', null);

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'vistoria-id' }),
      }),
    );
    expect(findFirst).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deleted_at: null }),
      }),
    );
  });

  it('findAll filtra por cliente_id quando fornecido', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = makePrisma({ vistorias: { findMany, count: jest.fn() } as any });
    const repo = new PrismaVistoriaReadRepository(prisma as any);

    await repo.findAll({ clienteId: 'tenant-uuid' } as any);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ cliente_id: 'tenant-uuid' }),
      }),
    );
  });

  it('P3: findAll filtra deleted_at: null via buildWhere', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = makePrisma({ vistorias: { findMany, count: jest.fn() } as any });
    const repo = new PrismaVistoriaReadRepository(prisma as any);

    await repo.findAll({} as any);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deleted_at: null }),
      }),
    );
  });

  it('P3: findByIdComDetalhes inclui filhas com where deleted_at: null', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = makePrisma({ vistorias: { findFirst } as any });
    const repo = new PrismaVistoriaReadRepository(prisma as any);

    await repo.findByIdComDetalhes('vistoria-id');

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          calhas: DELETED_AT_NULL,
          depositos: DELETED_AT_NULL,
        }),
      }),
    );
  });
});
