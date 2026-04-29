import { ForbiddenException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { mockRequest } from '@test/utils/user-helpers';

import { SlaReadRepository } from '../../repositories/sla-read.repository';
import { GetConfig } from '../get-config';
import { SlaConfigBuilder } from './builders/sla-config.builder';

describe('GetConfig', () => {
  let useCase: GetConfig;
  const readRepo = mock<SlaReadRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetConfig,
        { provide: SlaReadRepository, useValue: readRepo },
        { provide: REQUEST, useValue: mockRequest({ tenantId: 'tenant-cfg-1' }) },
      ],
    }).compile();
    useCase = module.get<GetConfig>(GetConfig);
  });

  it('deve chamar findConfig com clienteId do tenant', async () => {
    const config = new SlaConfigBuilder().build();
    readRepo.findConfig.mockResolvedValue(config);

    const result = await useCase.execute();

    expect(readRepo.findConfig).toHaveBeenCalledWith('tenant-cfg-1');
    expect(result.config).toBe(config);
  });

  it('deve retornar config vazia quando não existe configuração', async () => {
    readRepo.findConfig.mockResolvedValue(null);

    const result = await useCase.execute();

    expect(result.config).toEqual({ clienteId: 'tenant-cfg-1', config: {} });
  });

  describe('com platform scope (admin sem tenant)', () => {
    let ucAdmin: GetConfig;

    beforeEach(async () => {
      jest.clearAllMocks();
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          GetConfig,
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
      ucAdmin = module.get<GetConfig>(GetConfig);
    });

    it('deve lançar ForbiddenException quando admin sem tenant', async () => {
      await expect(ucAdmin.execute()).rejects.toThrow(ForbiddenException);
      expect(readRepo.findConfig).not.toHaveBeenCalled();
    });
  });
});
