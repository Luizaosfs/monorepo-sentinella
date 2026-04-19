import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mockRequest } from '@test/utils/user-helpers';

import { ListarComVinculos } from '../listar-com-vinculos';

const mockPrisma = {
  client: {
    $queryRaw: jest.fn(),
  },
};

describe('ListarComVinculos', () => {
  let useCase: ListarComVinculos;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListarComVinculos,
        { provide: 'PrismaService', useValue: mockPrisma },
        { provide: REQUEST, useValue: mockRequest({ tenantId: 'test-cliente-id' }) },
      ],
    })
      .overrideProvider(ListarComVinculos)
      .useFactory({
        factory: () => {
          const uc = new ListarComVinculos(mockPrisma as any, mockRequest({ tenantId: 'test-cliente-id' }) as any);
          return uc;
        },
      })
      .compile();
    useCase = module.get<ListarComVinculos>(ListarComVinculos);
  });

  it('deve chamar $queryRaw com clienteId do tenant', async () => {
    mockPrisma.client.$queryRaw.mockResolvedValue([{ id: 'op-1', status: 'pendente' }]);

    const result = await useCase.execute({});

    expect(mockPrisma.client.$queryRaw).toHaveBeenCalled();
    expect(result).toEqual([{ id: 'op-1', status: 'pendente' }]);
  });

  it('deve aplicar filtro de status quando fornecido', async () => {
    mockPrisma.client.$queryRaw.mockResolvedValue([]);

    await useCase.execute({ status: 'em_andamento' });

    expect(mockPrisma.client.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
