import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { VistoriaReadRepository } from '../../repositories/vistoria-read.repository';
import { mockRequest } from '@test/utils/user-helpers';

import { FilterVistoria } from '../filter-vistoria';
import { VistoriaBuilder } from './builders/vistoria.builder';

const TENANT_FALLBACK = '33333333-3333-4333-8333-333333333333';
const EXPLICIT_CLIENTE = '22222222-2222-4222-8222-222222222222';
const OTHER_TENANT = '11111111-1111-4111-8111-111111111111';

describe('FilterVistoria', () => {
  let useCase: FilterVistoria;
  const readRepo = mock<VistoriaReadRepository>();

  async function createModule(
    req = mockRequest({ tenantId: TENANT_FALLBACK }),
  ) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilterVistoria,
        { provide: VistoriaReadRepository, useValue: readRepo },
        { provide: REQUEST, useValue: req },
      ],
    }).compile();
    return module.get<FilterVistoria>(FilterVistoria);
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    useCase = await createModule();
  });

  it('deve usar clienteId do filtro quando fornecido', async () => {
    useCase = await createModule(mockRequest({ tenantId: OTHER_TENANT }));
    const list = [new VistoriaBuilder().build()];
    readRepo.findAll.mockResolvedValue(list);

    const result = await useCase.execute({
      clienteId: EXPLICIT_CLIENTE,
      status: 'pendente',
    });

    expect(result.vistorias).toBe(list);
    expect(readRepo.findAll).toHaveBeenCalledWith({
      clienteId: EXPLICIT_CLIENTE,
      status: 'pendente',
    });
  });

  it('deve usar tenantId do request quando clienteId não informado no filtro', async () => {
    readRepo.findAll.mockResolvedValue([]);

    await useCase.execute({ status: 'concluido' });

    expect(readRepo.findAll).toHaveBeenCalledWith({
      clienteId: TENANT_FALLBACK,
      status: 'concluido',
    });
  });

  it('deve delegar ao repository.findAll e retornar { vistorias }', async () => {
    const vistorias = [new VistoriaBuilder().build()];
    readRepo.findAll.mockResolvedValue(vistorias);

    const result = await useCase.execute({});

    expect(result).toEqual({ vistorias });
    expect(readRepo.findAll).toHaveBeenCalledWith({
      clienteId: TENANT_FALLBACK,
    });
  });
});
