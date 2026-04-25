import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { GetRegionalSla } from '../get-regional-sla';

describe('GetRegionalSla', () => {
  let useCase: GetRegionalSla;
  const mockQueryRaw = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetRegionalSla,
        {
          provide: PrismaService,
          useValue: { client: { $queryRaw: mockQueryRaw } },
        },
      ],
    }).compile();

    useCase = module.get<GetRegionalSla>(GetRegionalSla);
  });

  it('escopo municipal — 1 cliente', async () => {
    mockQueryRaw.mockResolvedValue([{ cliente_id: 'c1', total_ativos: 4 }]);

    const result = await useCase.execute(['c1']);

    expect(result).toEqual([{ cliente_id: 'c1', total_ativos: 4 }]);
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it('escopo regional — N clientes — uma única query', async () => {
    mockQueryRaw.mockResolvedValue([
      { cliente_id: 'c1' },
      { cliente_id: 'c2' },
    ]);

    const result = await useCase.execute(['c1', 'c2']);

    expect(result).toHaveLength(2);
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it('escopo total admin — clienteIds null', async () => {
    mockQueryRaw.mockResolvedValue([{ cliente_id: 'c1' }, { cliente_id: 'c2' }]);

    const result = await useCase.execute(null);

    expect(result).toHaveLength(2);
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it('lista vazia — retorna [] sem SQL', async () => {
    const result = await useCase.execute([]);

    expect(result).toEqual([]);
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });
});
