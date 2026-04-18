import { PrismaVistoriaReadRepository } from './prisma-vistoria-read.repository';

const makePrisma = (overrides: Record<string, any> = {}) => ({
  client: {
    vistorias: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    $transaction: jest.fn().mockResolvedValue([[], 0]),
    ...overrides,
  },
});

describe('PrismaVistoriaReadRepository — tenant isolation', () => {
  it('findByIdComDetalhes inclui depositos via include (não query direta)', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const prisma = makePrisma({ vistorias: { findUnique } as any });
    const repo = new PrismaVistoriaReadRepository(prisma as any);

    await repo.findByIdComDetalhes('vistoria-id');

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({ depositos: true }),
      }),
    );
  });

  it('findByIdComDetalhes inclui riscos via include', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const prisma = makePrisma({ vistorias: { findUnique } as any });
    const repo = new PrismaVistoriaReadRepository(prisma as any);

    await repo.findByIdComDetalhes('vistoria-id');

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({ riscos: true }),
      }),
    );
  });

  it('findByIdComDetalhes inclui sintomas via include', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const prisma = makePrisma({ vistorias: { findUnique } as any });
    const repo = new PrismaVistoriaReadRepository(prisma as any);

    await repo.findByIdComDetalhes('vistoria-id');

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({ sintomas: true }),
      }),
    );
  });

  it('findByIdComDetalhes inclui calhas via include', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const prisma = makePrisma({ vistorias: { findUnique } as any });
    const repo = new PrismaVistoriaReadRepository(prisma as any);

    await repo.findByIdComDetalhes('vistoria-id');

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({ calhas: true }),
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
});
