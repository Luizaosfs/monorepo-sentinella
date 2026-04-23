import { Prisma } from '@prisma/client';

import { PrismaPesosConsolidacaoReadRepository } from './prisma-pesos-consolidacao-read.repository';

const mockQueryRaw = jest.fn();
const mockPrisma = {
  client: { $queryRaw: mockQueryRaw },
} as any;

describe('PrismaPesosConsolidacaoReadRepository', () => {
  let repo: PrismaPesosConsolidacaoReadRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new PrismaPesosConsolidacaoReadRepository(mockPrisma);
  });

  it('findLimiar retorna peso e versao quando encontrado', async () => {
    mockQueryRaw.mockResolvedValue([{ peso: '2.50', versao: 'v1.0' }]);

    const result = await repo.findLimiar('limiar_baixo_medio', 'cliente-1');

    expect(result).not.toBeNull();
    expect(result!.peso).toEqual(new Prisma.Decimal('2.50'));
    expect(result!.versao).toBe('v1.0');
  });

  it('findLimiar retorna null quando não há config', async () => {
    mockQueryRaw.mockResolvedValue([]);

    const result = await repo.findLimiar('limiar_medio_alto', 'cliente-1');

    expect(result).toBeNull();
  });

  it('findFlagsSemPeso retorna flags que não têm peso configurado', async () => {
    mockQueryRaw.mockResolvedValue([{ flag_nome: 'dep_quimico' }]);

    const result = await repo.findFlagsSemPeso(
      ['dep_quimico', 'lixo', 'menor_incapaz'],
      'cliente-1',
    );

    expect(result).toEqual(['lixo', 'menor_incapaz']);
  });

  it('findFlagsSemPeso retorna [] para lista vazia', async () => {
    const result = await repo.findFlagsSemPeso([], 'cliente-1');

    expect(result).toEqual([]);
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it('calcularScoresEfetivos retorna scores como Decimal', async () => {
    mockQueryRaw.mockResolvedValue([{ score_social: '3.00', score_sanitario: '1.50' }]);

    const result = await repo.calcularScoresEfetivos(['dep_quimico', 'lixo'], 'cliente-1');

    expect(result.scoreSocial).toEqual(new Prisma.Decimal('3.00'));
    expect(result.scoreSanitario).toEqual(new Prisma.Decimal('1.50'));
  });

  it('calcularScoresEfetivos retorna zeros para lista vazia (sem query)', async () => {
    const result = await repo.calcularScoresEfetivos([], 'cliente-1');

    expect(result.scoreSocial).toEqual(new Prisma.Decimal('0'));
    expect(result.scoreSanitario).toEqual(new Prisma.Decimal('0'));
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });
});
