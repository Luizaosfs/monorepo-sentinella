import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { mockRequest } from '@test/utils/user-helpers';

import { SlaReadRepository } from '../../repositories/sla-read.repository';
import { ListSla } from '../list-sla';

describe('ListSla', () => {
  let useCase: ListSla;
  const readRepo = mock<SlaReadRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListSla,
        { provide: SlaReadRepository, useValue: readRepo },
        { provide: REQUEST, useValue: mockRequest({ tenantId: 'tenant-sla-1' }) },
      ],
    }).compile();
    useCase = module.get<ListSla>(ListSla);
  });

  it('deve filtrar pelo clienteId do tenant (MT-02)', async () => {
    readRepo.findAll.mockResolvedValue([]);

    await useCase.execute({ status: 'pendente' });

    expect(readRepo.findAll).toHaveBeenCalledWith({ status: 'pendente', clienteId: 'tenant-sla-1' });
  });

  it('deve ignorar clienteId do filtro em favor do tenant', async () => {
    readRepo.findAll.mockResolvedValue([]);

    await useCase.execute({ clienteId: 'outro-cliente-id' });

    expect(readRepo.findAll).toHaveBeenCalledWith({ clienteId: 'tenant-sla-1' });
  });

  describe('com platform scope (admin sem tenant)', () => {
    let ucAdmin: ListSla;

    beforeEach(async () => {
      jest.clearAllMocks();
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ListSla,
          { provide: SlaReadRepository, useValue: readRepo },
          {
            provide: REQUEST,
            useValue: mockRequest({
              accessScope: {
                kind: 'platform' as const,
                userId: 'admin-id',
                papeis: ['admin'] as any,
                isAdmin: true,
                tenantId: null,
                clienteIdsPermitidos: null,
                agrupamentoId: null,
              },
            }),
          },
        ],
      }).compile();
      ucAdmin = module.get<ListSla>(ListSla);
    });

    it('deve chamar findAll sem clienteId quando admin sem tenant', async () => {
      readRepo.findAll.mockResolvedValue([]);

      await ucAdmin.execute({ status: 'em_andamento' });

      expect(readRepo.findAll).toHaveBeenCalledWith({ status: 'em_andamento', clienteId: undefined });
    });
  });
});
