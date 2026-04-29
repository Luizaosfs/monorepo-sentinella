import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { mockRequest } from '@test/utils/user-helpers';

import { SlaReadRepository } from '../../repositories/sla-read.repository';
import { CountPendentes } from '../count-pendentes';

describe('CountPendentes', () => {
  let useCase: CountPendentes;
  const readRepo = mock<SlaReadRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CountPendentes,
        { provide: SlaReadRepository, useValue: readRepo },
        { provide: REQUEST, useValue: mockRequest({ tenantId: 'tenant-count-1' }) },
      ],
    }).compile();
    useCase = module.get<CountPendentes>(CountPendentes);
  });

  it('deve contar pendentes com clienteId do tenant', async () => {
    readRepo.countPendentes.mockResolvedValue({ total: 5 });

    const result = await useCase.execute();

    expect(readRepo.countPendentes).toHaveBeenCalledWith('tenant-count-1');
    expect(result).toEqual({ total: 5 });
  });

  describe('com platform scope (admin sem tenant)', () => {
    let ucAdmin: CountPendentes;

    beforeEach(async () => {
      jest.clearAllMocks();
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CountPendentes,
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
      ucAdmin = module.get<CountPendentes>(CountPendentes);
    });

    it('deve chamar countPendentes com null quando admin sem tenant', async () => {
      readRepo.countPendentes.mockResolvedValue({ total: 42 });

      await ucAdmin.execute();

      expect(readRepo.countPendentes).toHaveBeenCalledWith(null);
    });
  });
});
