import { ForbiddenException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { mockRequest } from '@test/utils/user-helpers';

import { SlaReadRepository } from '../../repositories/sla-read.repository';
import { SlaFeriadoBuilder } from './builders/sla-config.builder';
import { ListFeriados } from '../list-feriados';

describe('ListFeriados', () => {
  let useCase: ListFeriados;
  const readRepo = mock<SlaReadRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListFeriados,
        { provide: SlaReadRepository, useValue: readRepo },
        { provide: REQUEST, useValue: mockRequest({ tenantId: 'test-cliente-id' }) },
      ],
    }).compile();
    useCase = module.get<ListFeriados>(ListFeriados);
  });

  it('deve listar feriados com clienteId do tenant', async () => {
    const feriados = [new SlaFeriadoBuilder().build()];
    readRepo.findFeriados.mockResolvedValue(feriados);

    const result = await useCase.execute();

    expect(readRepo.findFeriados).toHaveBeenCalledWith('test-cliente-id');
    expect(result.feriados).toBe(feriados);
  });

  describe('com platform scope (admin sem tenant)', () => {
    let ucAdmin: ListFeriados;

    beforeEach(async () => {
      jest.clearAllMocks();
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ListFeriados,
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
      ucAdmin = module.get<ListFeriados>(ListFeriados);
    });

    it('deve lançar ForbiddenException quando admin sem tenant', async () => {
      await expect(ucAdmin.execute()).rejects.toThrow(ForbiddenException);
      expect(readRepo.findFeriados).not.toHaveBeenCalled();
    });
  });
});
