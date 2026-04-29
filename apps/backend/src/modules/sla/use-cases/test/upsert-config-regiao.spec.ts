import { ForbiddenException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { mockRequest } from '@test/utils/user-helpers';

import { SlaWriteRepository } from '../../repositories/sla-write.repository';
import { UpsertConfigRegiao } from '../upsert-config-regiao';

describe('UpsertConfigRegiao', () => {
  let useCase: UpsertConfigRegiao;
  const writeRepo = mock<SlaWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpsertConfigRegiao,
        { provide: SlaWriteRepository, useValue: writeRepo },
        { provide: REQUEST, useValue: mockRequest({ tenantId: 'tenant-regiao-1' }) },
      ],
    }).compile();
    useCase = module.get<UpsertConfigRegiao>(UpsertConfigRegiao);
  });

  it('deve chamar upsertConfigRegiao com clienteId do tenant', async () => {
    writeRepo.upsertConfigRegiao.mockResolvedValue();

    const config = { prazoP1: 4 };
    const result = await useCase.execute('regiao-uuid-1', { config });

    expect(writeRepo.upsertConfigRegiao).toHaveBeenCalledWith('tenant-regiao-1', 'regiao-uuid-1', config);
    expect(result).toEqual({ updated: true });
  });

  describe('com platform scope (admin sem tenant)', () => {
    let ucAdmin: UpsertConfigRegiao;

    beforeEach(async () => {
      jest.clearAllMocks();
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          UpsertConfigRegiao,
          { provide: SlaWriteRepository, useValue: writeRepo },
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
      ucAdmin = module.get<UpsertConfigRegiao>(UpsertConfigRegiao);
    });

    it('deve lançar ForbiddenException quando admin sem tenant', async () => {
      await expect(ucAdmin.execute('regiao-uuid-1', { config: { prazoP1: 4 } })).rejects.toThrow(ForbiddenException);
      expect(writeRepo.upsertConfigRegiao).not.toHaveBeenCalled();
    });
  });
});
