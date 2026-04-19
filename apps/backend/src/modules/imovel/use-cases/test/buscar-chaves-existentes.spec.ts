import { mockRequest } from '@test/utils/user-helpers';

import { BuscarChavesExistentes } from '../buscar-chaves-existentes';

const mockPrismaImoveis = { findMany: jest.fn() };
const mockPrisma = { client: { imoveis: mockPrismaImoveis } };

describe('BuscarChavesExistentes', () => {
  let useCase: BuscarChavesExistentes;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new BuscarChavesExistentes(mockPrisma as any, mockRequest({ tenantId: 'test-cliente-id' }) as any);
  });

  it('deve retornar array de chaves "logradouro|numero|bairro" em lowercase', async () => {
    mockPrismaImoveis.findMany.mockResolvedValue([
      { logradouro: 'Rua das Flores', numero: '123', bairro: 'Centro' },
      { logradouro: 'Avenida Brasil', numero: '456', bairro: 'Jardim' },
    ]);

    const result = await useCase.execute();

    expect(result).toEqual([
      'rua das flores|123|centro',
      'avenida brasil|456|jardim',
    ]);
  });

  it('deve filtrar apenas imóveis ativos do cliente correto', async () => {
    mockPrismaImoveis.findMany.mockResolvedValue([]);

    await useCase.execute();

    expect(mockPrismaImoveis.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          cliente_id: 'test-cliente-id',
          ativo: true,
          deleted_at: null,
        }),
      }),
    );
  });

  it('deve tratar logradouro/numero/bairro null como string vazia', async () => {
    mockPrismaImoveis.findMany.mockResolvedValue([
      { logradouro: null, numero: null, bairro: null },
    ]);

    const result = await useCase.execute();

    expect(result).toEqual(['||']);
  });
});
