import { mockRequest } from '@test/utils/user-helpers';

import { BatchCreateImoveisInput } from '../../dtos/batch-create-imoveis.body';
import { BatchCreateImoveis } from '../batch-create-imoveis';

const mockPrismaImoveis = { createMany: jest.fn() };
const mockPrisma = { client: { imoveis: mockPrismaImoveis } };

const makeRegistro = (overrides = {}) => ({
  tipoImovel: 'residencial',
  logradouro: 'Rua A',
  numero: '1',
  bairro: 'Centro',
  ativo: true,
  proprietarioAusente: false,
  temAnimalAgressivo: false,
  historicoRecusa: false,
  temCalha: false,
  calhaAcessivel: true,
  prioridadeDrone: false,
  ...overrides,
});

describe('BatchCreateImoveis', () => {
  let useCase: BatchCreateImoveis;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new BatchCreateImoveis(mockPrisma as any, mockRequest({ tenantId: 'test-cliente-id' }) as any);
  });

  it('deve criar registros em lote e retornar { importados, falhas }', async () => {
    mockPrismaImoveis.createMany.mockResolvedValue({ count: 2 });

    const data: BatchCreateImoveisInput = {
      registros: [makeRegistro(), makeRegistro({ numero: '2' })],
    };
    const result = await useCase.execute(data);

    expect(result.importados).toBe(2);
    expect(result.falhas).toBe(0);
    expect(mockPrismaImoveis.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ cliente_id: 'test-cliente-id', logradouro: 'Rua A' }),
        ]),
      }),
    );
  });

  it('deve contar falhas quando createMany lança exceção', async () => {
    mockPrismaImoveis.createMany.mockRejectedValue(new Error('DB error'));

    const data: BatchCreateImoveisInput = { registros: [makeRegistro()] };
    const result = await useCase.execute(data);

    expect(result.importados).toBe(0);
    expect(result.falhas).toBe(1);
  });

  it('deve processar em chunks de 500', async () => {
    mockPrismaImoveis.createMany.mockResolvedValue({ count: 500 });

    const registros = Array.from({ length: 1001 }, (_, i) => makeRegistro({ numero: String(i) }));
    const data: BatchCreateImoveisInput = { registros };
    const result = await useCase.execute(data);

    expect(mockPrismaImoveis.createMany).toHaveBeenCalledTimes(3);
    expect(result.importados).toBe(1500);
  });
});
