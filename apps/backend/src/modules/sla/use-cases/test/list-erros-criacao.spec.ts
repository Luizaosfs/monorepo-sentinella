import { ForbiddenException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { mockRequest } from '@test/utils/user-helpers';

import { SlaReadRepository } from '../../repositories/sla-read.repository';
import { ListErrosCriacao } from '../list-erros-criacao';

describe('ListErrosCriacao', () => {
  let useCase: ListErrosCriacao;
  const readRepo = mock<SlaReadRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListErrosCriacao,
        { provide: SlaReadRepository, useValue: readRepo },
        { provide: REQUEST, useValue: mockRequest({ tenantId: 'test-cliente-id' }) },
      ],
    }).compile();
    useCase = module.get<ListErrosCriacao>(ListErrosCriacao);
  });

  it('deve listar erros de criação com clienteId do tenant', async () => {
    readRepo.findErrosCriacao.mockResolvedValue([]);

    const result = await useCase.execute();

    expect(readRepo.findErrosCriacao).toHaveBeenCalledWith('test-cliente-id', 20);
    expect(result.erros).toEqual([]);
  });

  describe('com platform scope (admin sem tenant)', () => {
    let ucAdmin: ListErrosCriacao;

    beforeEach(async () => {
      jest.clearAllMocks();
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ListErrosCriacao,
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
      ucAdmin = module.get<ListErrosCriacao>(ListErrosCriacao);
    });

    it('deve lançar ForbiddenException quando admin sem tenant', async () => {
      await expect(ucAdmin.execute()).rejects.toThrow(ForbiddenException);
      expect(readRepo.findErrosCriacao).not.toHaveBeenCalled();
    });
  });
});
