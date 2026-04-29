import { ForbiddenException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { mockRequest } from '@test/utils/user-helpers';

import { SlaReadRepository } from '../../repositories/sla-read.repository';
import { ListSlaPainel } from '../list-sla-painel';

describe('ListSlaPainel', () => {
  let useCase: ListSlaPainel;
  const readRepo = mock<SlaReadRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListSlaPainel,
        { provide: SlaReadRepository, useValue: readRepo },
        { provide: REQUEST, useValue: mockRequest({ tenantId: 'test-cliente-id' }) },
      ],
    }).compile();
    useCase = module.get<ListSlaPainel>(ListSlaPainel);
  });

  it('deve listar painel com clienteId do tenant', async () => {
    readRepo.findPainel.mockResolvedValue([]);

    const result = await useCase.execute();

    expect(readRepo.findPainel).toHaveBeenCalledWith('test-cliente-id', undefined);
    expect(result.slas).toEqual([]);
  });

  it('deve repassar agenteId ao repositório', async () => {
    readRepo.findPainel.mockResolvedValue([]);

    await useCase.execute('agente-uuid-1');

    expect(readRepo.findPainel).toHaveBeenCalledWith('test-cliente-id', 'agente-uuid-1');
  });

  describe('com platform scope (admin sem tenant)', () => {
    let ucAdmin: ListSlaPainel;

    beforeEach(async () => {
      jest.clearAllMocks();
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ListSlaPainel,
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
      ucAdmin = module.get<ListSlaPainel>(ListSlaPainel);
    });

    it('deve lançar ForbiddenException quando admin sem tenant', async () => {
      await expect(ucAdmin.execute()).rejects.toThrow(ForbiddenException);
      expect(readRepo.findPainel).not.toHaveBeenCalled();
    });
  });
});
