import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@shared/modules/database/prisma/prisma.service';

import { CountAtivasByCliente } from '../count-ativas-by-cliente';

describe('CountAtivasByCliente', () => {
  let useCase: CountAtivasByCliente;
  const mockQueryRaw = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CountAtivasByCliente,
        {
          provide: PrismaService,
          useValue: { client: { $queryRaw: mockQueryRaw } },
        },
      ],
    }).compile();

    useCase = module.get<CountAtivasByCliente>(CountAtivasByCliente);
  });

  it('retorna contagem de recorrências ativas', async () => {
    mockQueryRaw.mockResolvedValue([{ total: 5 }]);

    const result = await useCase.execute('cliente-uuid');

    expect(result).toBe(5);
  });

  it('retorna 0 quando sem recorrências', async () => {
    mockQueryRaw.mockResolvedValue([{ total: 0 }]);

    const result = await useCase.execute('cliente-uuid');

    expect(result).toBe(0);
  });

  it('retorna 0 quando query retorna array vazio', async () => {
    mockQueryRaw.mockResolvedValue([]);

    const result = await useCase.execute('cliente-uuid');

    expect(result).toBe(0);
  });
});
