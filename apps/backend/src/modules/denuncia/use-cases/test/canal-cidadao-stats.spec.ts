import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { CanalCidadaoStats } from '../canal-cidadao-stats';

describe('CanalCidadaoStats', () => {
  let useCase: CanalCidadaoStats;
  const mockQueryRaw = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CanalCidadaoStats,
        {
          provide: PrismaService,
          useValue: { client: { $queryRaw: mockQueryRaw } },
        },
      ],
    }).compile();

    useCase = module.get<CanalCidadaoStats>(CanalCidadaoStats);
  });

  it('retorna estatísticas do canal cidadão', async () => {
    const stats = {
      total: 42,
      ultimas_24h: 3,
      ultimos_7d: 12,
      ultimos_30d: 35,
      com_foco_vinculado: 20,
      resolvidos: 10,
      em_aberto: 32,
    };
    mockQueryRaw.mockResolvedValue([stats]);

    const result = await useCase.execute('cliente-uuid');

    expect(result).toEqual(stats);
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it('retorna null quando sem resultados', async () => {
    mockQueryRaw.mockResolvedValue([]);

    const result = await useCase.execute('cliente-uuid');

    expect(result).toBeNull();
  });
});
