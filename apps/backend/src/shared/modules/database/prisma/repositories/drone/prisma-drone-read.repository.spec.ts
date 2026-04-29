import { PrismaDroneMapper } from '../../mappers/prisma-drone.mapper';
import { PrismaService } from '../../prisma.service';
import { PrismaDroneReadRepository } from './prisma-drone-read.repository';
import { Voo } from 'src/modules/drone/entities/drone';

describe('PrismaDroneReadRepository.findVoos — isolamento cross-tenant', () => {
  let repo: PrismaDroneReadRepository;
  let findMany: jest.Mock;

  const fakeVoo = { id: 'voo-1' } as unknown as Voo;

  beforeEach(() => {
    findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      client: { voos: { findMany } },
    } as unknown as PrismaService;
    repo = new PrismaDroneReadRepository(prisma);
    jest.spyOn(PrismaDroneMapper, 'vooToDomain').mockReturnValue(fakeVoo);
  });

  afterEach(() => jest.restoreAllMocks());

  it('passa where:{ cliente_id } e retorna voos do tenant correto', async () => {
    findMany.mockResolvedValue([{ id: 'row-1' }]);

    const result = await repo.findVoos('tenant-a');

    expect(findMany).toHaveBeenCalledWith({
      where: { planejamento: { cliente_id: 'tenant-a' } },
      orderBy: { created_at: 'desc' },
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(fakeVoo);
  });

  it('tenant-b não recebe voos de tenant-a — WHERE isola por planejamento.cliente_id', async () => {
    findMany.mockResolvedValue([]);

    const result = await repo.findVoos('tenant-b');

    expect(findMany).toHaveBeenCalledWith({
      where: { planejamento: { cliente_id: 'tenant-b' } },
      orderBy: { created_at: 'desc' },
    });
    expect(result).toHaveLength(0);
  });
});
