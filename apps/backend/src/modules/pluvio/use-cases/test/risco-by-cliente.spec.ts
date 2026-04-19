import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { RiscoByCliente } from '../risco-by-cliente';

describe('RiscoByCliente', () => {
  let useCase: RiscoByCliente;
  const mockQueryRaw = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiscoByCliente,
        {
          provide: PrismaService,
          useValue: { client: { $queryRaw: mockQueryRaw } },
        },
      ],
    }).compile();

    useCase = module.get<RiscoByCliente>(RiscoByCliente);
  });

  it('retorna riscos pluviométricos das regiões do cliente', async () => {
    const rows = [
      { regiao_id: 'r1', regiao_nome: 'Centro', nivel_risco: 'alto', chuva_24h: 45 },
      { regiao_id: 'r2', regiao_nome: 'Norte', nivel_risco: null, chuva_24h: null },
    ];
    mockQueryRaw.mockResolvedValue(rows);

    const result = await useCase.execute('cliente-uuid');

    expect(result).toBe(rows);
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it('retorna array vazio quando cliente não tem regiões', async () => {
    mockQueryRaw.mockResolvedValue([]);

    const result = await useCase.execute('cliente-sem-regioes');

    expect(result).toEqual([]);
  });
});
