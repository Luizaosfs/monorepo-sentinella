import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mockRequest } from '@test/utils/user-helpers';
import { mock } from 'jest-mock-extended';

import { OperacaoReadRepository } from '../../repositories/operacao-read.repository';
import { StatsOperacao } from '../stats-operacao';

describe('StatsOperacao', () => {
  let useCase: StatsOperacao;
  const readRepo = mock<OperacaoReadRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatsOperacao,
        { provide: OperacaoReadRepository, useValue: readRepo },
        {
          provide: REQUEST,
          useValue: mockRequest({ tenantId: 'tenant-stats-1' }),
        },
      ],
    }).compile();

    useCase = module.get<StatsOperacao>(StatsOperacao);
  });

  it('deve retornar contagens por status para o tenant atual', async () => {
    const byStatus = { pendente: 3, em_andamento: 1, concluido: 10 };
    readRepo.countByStatus.mockResolvedValue(byStatus);

    const result = await useCase.execute();

    expect(result.byStatus).toEqual(byStatus);
    expect(readRepo.countByStatus).toHaveBeenCalledWith('tenant-stats-1');
  });

  it('deve retornar objeto vazio quando não há operações', async () => {
    readRepo.countByStatus.mockResolvedValue({});

    const result = await useCase.execute();

    expect(result.byStatus).toEqual({});
  });

  describe('com platform scope (admin sem tenant)', () => {
    let ucAdmin: StatsOperacao;

    beforeEach(async () => {
      jest.clearAllMocks();
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          StatsOperacao,
          { provide: OperacaoReadRepository, useValue: readRepo },
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

      ucAdmin = module.get<StatsOperacao>(StatsOperacao);
    });

    it('deve chamar countByStatus com null quando admin sem tenant', async () => {
      readRepo.countByStatus.mockResolvedValue({});

      await ucAdmin.execute();

      expect(readRepo.countByStatus).toHaveBeenCalledWith(null);
    });
  });
});
