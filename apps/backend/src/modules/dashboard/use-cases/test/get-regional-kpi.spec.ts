import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { GetRegionalKpi } from '../get-regional-kpi';

describe('GetRegionalKpi', () => {
  let useCase: GetRegionalKpi;
  const mockQueryRaw = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetRegionalKpi,
        {
          provide: PrismaService,
          useValue: { client: { $queryRaw: mockQueryRaw } },
        },
      ],
    }).compile();

    useCase = module.get<GetRegionalKpi>(GetRegionalKpi);
  });

  it('escopo municipal — 1 cliente — chama queryRaw com filtro de cliente', async () => {
    mockQueryRaw.mockResolvedValue([{ cliente_id: 'c1', total_focos: 10 }]);

    const result = await useCase.execute(['c1']);

    expect(result).toEqual([{ cliente_id: 'c1', total_focos: 10 }]);
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it('escopo regional — N clientes — chama queryRaw uma vez com lista', async () => {
    mockQueryRaw.mockResolvedValue([
      { cliente_id: 'c1', total_focos: 5 },
      { cliente_id: 'c2', total_focos: 8 },
      { cliente_id: 'c3', total_focos: 0 },
    ]);

    const result = await useCase.execute(['c1', 'c2', 'c3']);

    expect(result).toHaveLength(3);
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it('escopo total admin — clienteIds null — chama queryRaw sem filtro de cliente', async () => {
    mockQueryRaw.mockResolvedValue([
      { cliente_id: 'c1', total_focos: 5 },
      { cliente_id: 'c2', total_focos: 8 },
    ]);

    const result = await useCase.execute(null);

    expect(result).toHaveLength(2);
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it('lista vazia — retorna [] sem rodar SQL (defensivo)', async () => {
    const result = await useCase.execute([]);

    expect(result).toEqual([]);
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });
});
