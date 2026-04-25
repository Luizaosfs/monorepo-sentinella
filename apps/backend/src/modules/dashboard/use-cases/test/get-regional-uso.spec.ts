import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { GetRegionalUso } from '../get-regional-uso';

describe('GetRegionalUso', () => {
  let useCase: GetRegionalUso;
  const mockQueryRaw = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetRegionalUso,
        {
          provide: PrismaService,
          useValue: { client: { $queryRaw: mockQueryRaw } },
        },
      ],
    }).compile();

    useCase = module.get<GetRegionalUso>(GetRegionalUso);
  });

  it('escopo municipal — 1 cliente', async () => {
    mockQueryRaw.mockResolvedValue([{ cliente_id: 'c1', eventos_7d: 12 }]);

    const result = await useCase.execute(['c1']);

    expect(result).toEqual([{ cliente_id: 'c1', eventos_7d: 12 }]);
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it('escopo regional — N clientes', async () => {
    mockQueryRaw.mockResolvedValue([
      { cliente_id: 'c1', eventos_7d: 1 },
      { cliente_id: 'c2', eventos_7d: 0 },
    ]);

    const result = await useCase.execute(['c1', 'c2']);

    expect(result).toHaveLength(2);
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it('escopo total admin — clienteIds null', async () => {
    mockQueryRaw.mockResolvedValue([{ cliente_id: 'c1', eventos_7d: 5 }]);

    const result = await useCase.execute(null);

    expect(result).toHaveLength(1);
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it('lista vazia — retorna [] sem SQL', async () => {
    const result = await useCase.execute([]);

    expect(result).toEqual([]);
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });
});
