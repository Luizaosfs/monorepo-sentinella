import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mockRequest } from '@test/utils/user-helpers';

import { FindByEndereco } from '../find-by-endereco';

const mockImovelRaw = {
  id: 'imovel-uuid-1',
  cliente_id: 'test-cliente-id',
  regiao_id: null,
  tipo_imovel: 'residencial',
  logradouro: 'Rua das Flores',
  numero: '123',
  complemento: null,
  bairro: 'Centro',
  quarteirao: null,
  latitude: null,
  longitude: null,
  ativo: true,
  proprietario_ausente: false,
  tipo_ausencia: null,
  contato_proprietario: null,
  tem_animal_agressivo: false,
  historico_recusa: false,
  tem_calha: false,
  calha_acessivel: true,
  prioridade_drone: false,
  notificacao_formal_em: null,
};

const mockPrismaImoveis = { findFirst: jest.fn() };
const mockPrisma = { client: { imoveis: mockPrismaImoveis } };

describe('FindByEndereco', () => {
  let useCase: FindByEndereco;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: REQUEST, useValue: mockRequest({ tenantId: 'test-cliente-id' }) },
      ],
    })
      .overrideProvider(FindByEndereco)
      .useFactory({
        factory: () => new FindByEndereco(mockPrisma as any, mockRequest({ tenantId: 'test-cliente-id' }) as any),
      })
      .compile();

    useCase = new FindByEndereco(mockPrisma as any, mockRequest({ tenantId: 'test-cliente-id' }) as any);
  });

  it('deve retornar imóvel quando encontrado por logradouro e numero', async () => {
    mockPrismaImoveis.findFirst.mockResolvedValue(mockImovelRaw);

    const result = await useCase.execute('Rua das Flores', '123');

    expect(mockPrismaImoveis.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          cliente_id: 'test-cliente-id',
          logradouro: { contains: 'Rua das Flores', mode: 'insensitive' },
          numero: '123',
          ativo: true,
        }),
      }),
    );
    expect(result.imovel).not.toBeNull();
    expect(result.imovel?.logradouro).toBe('Rua das Flores');
  });

  it('deve retornar null quando imóvel não encontrado', async () => {
    mockPrismaImoveis.findFirst.mockResolvedValue(null);

    const result = await useCase.execute('Rua Inexistente', '999');

    expect(result.imovel).toBeNull();
  });
});
