import { mockRequest } from '@test/utils/user-helpers';

import { CountPrioridadeDrone } from '../count-prioridade-drone';

const mockPrismaImoveis = { count: jest.fn() };
const mockPrisma = { client: { imoveis: mockPrismaImoveis } };

describe('CountPrioridadeDrone', () => {
  let useCase: CountPrioridadeDrone;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new CountPrioridadeDrone(mockPrisma as any, mockRequest({ tenantId: 'test-cliente-id' }) as any);
  });

  it('deve retornar o número de imóveis com prioridade_drone=true para o cliente', async () => {
    mockPrismaImoveis.count.mockResolvedValue(42);

    const result = await useCase.execute();

    expect(mockPrismaImoveis.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          cliente_id: 'test-cliente-id',
          prioridade_drone: true,
          deleted_at: null,
        }),
      }),
    );
    expect(result).toBe(42);
  });

  it('deve retornar 0 quando não há imóveis com prioridade_drone', async () => {
    mockPrismaImoveis.count.mockResolvedValue(0);

    const result = await useCase.execute();

    expect(result).toBe(0);
  });
});
