import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { GetAnaliticoBairros } from '../get-analitico-bairros';

describe('GetAnaliticoBairros', () => {
  let useCase: GetAnaliticoBairros;
  const mockQueryRaw = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetAnaliticoBairros,
        {
          provide: PrismaService,
          useValue: { client: { $queryRaw: mockQueryRaw } },
        },
      ],
    }).compile();

    useCase = module.get<GetAnaliticoBairros>(GetAnaliticoBairros);
  });

  it('retorna lista de bairros distintos', async () => {
    mockQueryRaw.mockResolvedValue([
      { bairro: 'Centro' },
      { bairro: 'Norte' },
      { bairro: '(sem bairro)' },
    ]);

    const result = await useCase.execute('cliente-uuid');

    expect(result).toEqual(['Centro', 'Norte', '(sem bairro)']);
  });

  it('retorna array vazio quando sem vistorias', async () => {
    mockQueryRaw.mockResolvedValue([]);

    const result = await useCase.execute('cliente-uuid');

    expect(result).toEqual([]);
  });
});
