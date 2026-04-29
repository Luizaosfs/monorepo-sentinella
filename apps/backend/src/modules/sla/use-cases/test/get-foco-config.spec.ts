import { ForbiddenException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { mockRequest } from '@test/utils/user-helpers';

import { SlaReadRepository } from '../../repositories/sla-read.repository';
import { GetFocoConfig } from '../get-foco-config';

describe('GetFocoConfig', () => {
  let useCase: GetFocoConfig;
  const readRepo = mock<SlaReadRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetFocoConfig,
        { provide: SlaReadRepository, useValue: readRepo },
        { provide: REQUEST, useValue: mockRequest({ tenantId: 'tenant-foco-cfg-1' }) },
      ],
    }).compile();
    useCase = module.get<GetFocoConfig>(GetFocoConfig);
  });

  it('deve chamar findFocoConfig com clienteId do tenant', async () => {
    readRepo.findFocoConfig.mockResolvedValue([]);

    const result = await useCase.execute();

    expect(readRepo.findFocoConfig).toHaveBeenCalledWith('tenant-foco-cfg-1');
    expect(result.configs).toEqual([]);
  });

  describe('com platform scope (admin sem tenant)', () => {
    let ucAdmin: GetFocoConfig;

    beforeEach(async () => {
      jest.clearAllMocks();
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          GetFocoConfig,
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
      ucAdmin = module.get<GetFocoConfig>(GetFocoConfig);
    });

    it('deve lançar ForbiddenException quando admin sem tenant', async () => {
      await expect(ucAdmin.execute()).rejects.toThrow(ForbiddenException);
      expect(readRepo.findFocoConfig).not.toHaveBeenCalled();
    });
  });
});
