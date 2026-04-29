import { ForbiddenException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { mockRequest } from '@test/utils/user-helpers';

import { SlaReadRepository } from '../../repositories/sla-read.repository';
import { ListConfigRegioes } from '../list-config-regioes';

describe('ListConfigRegioes', () => {
  let useCase: ListConfigRegioes;
  const readRepo = mock<SlaReadRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListConfigRegioes,
        { provide: SlaReadRepository, useValue: readRepo },
        { provide: REQUEST, useValue: mockRequest({ tenantId: 'test-cliente-id' }) },
      ],
    }).compile();
    useCase = module.get<ListConfigRegioes>(ListConfigRegioes);
  });

  it('deve listar config de regiões com clienteId do tenant', async () => {
    readRepo.findConfigRegioes.mockResolvedValue([]);

    const result = await useCase.execute();

    expect(readRepo.findConfigRegioes).toHaveBeenCalledWith('test-cliente-id');
    expect(result.configs).toEqual([]);
  });

  describe('com platform scope (admin sem tenant)', () => {
    let ucAdmin: ListConfigRegioes;

    beforeEach(async () => {
      jest.clearAllMocks();
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ListConfigRegioes,
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
      ucAdmin = module.get<ListConfigRegioes>(ListConfigRegioes);
    });

    it('deve lançar ForbiddenException quando admin sem tenant', async () => {
      await expect(ucAdmin.execute()).rejects.toThrow(ForbiddenException);
      expect(readRepo.findConfigRegioes).not.toHaveBeenCalled();
    });
  });
});
