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

  it('retorna lista de bairros distintos (escopo municipal — 1 cliente)', async () => {
    mockQueryRaw.mockResolvedValue([
      { bairro: 'Centro' },
      { bairro: 'Norte' },
      { bairro: '(sem bairro)' },
    ]);

    const result = await useCase.execute(['cliente-uuid']);

    expect(result).toEqual(['Centro', 'Norte', '(sem bairro)']);
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it('retorna array vazio quando sem vistorias', async () => {
    mockQueryRaw.mockResolvedValue([]);

    const result = await useCase.execute(['cliente-uuid']);

    expect(result).toEqual([]);
  });

  it('retorna lista sem filtro quando clienteIds é null (admin escopo total)', async () => {
    mockQueryRaw.mockResolvedValue([{ bairro: 'Leste' }]);

    const result = await useCase.execute(null);

    expect(result).toEqual(['Leste']);
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it('retorna array vazio sem query quando clienteIds é lista vazia', async () => {
    const result = await useCase.execute([]);

    expect(result).toEqual([]);
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it('retorna lista de bairros para múltiplos clientes (escopo regional)', async () => {
    mockQueryRaw.mockResolvedValue([
      { bairro: 'Bairro A' },
      { bairro: 'Bairro B' },
    ]);

    const result = await useCase.execute(['c1', 'c2', 'c3']);

    expect(result).toEqual(['Bairro A', 'Bairro B']);
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });
});
