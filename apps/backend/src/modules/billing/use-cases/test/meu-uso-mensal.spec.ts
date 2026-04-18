import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { ClienteQuotas } from '../../entities/billing';
import { BillingReadRepository } from '../../repositories/billing-read.repository';

import { mockRequest } from '@test/utils/user-helpers';

import { MeuUsoMensal } from '../meu-uso-mensal';

describe('MeuUsoMensal', () => {
  let useCase: MeuUsoMensal;
  const readRepo = mock<BillingReadRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeuUsoMensal,
        { provide: BillingReadRepository, useValue: readRepo },
        { provide: REQUEST, useValue: mockRequest({ tenantId: 'cli-1' }) },
      ],
    }).compile();

    useCase = module.get<MeuUsoMensal>(MeuUsoMensal);
  });

  it('deve agregar uso e limites do cliente do tenant', async () => {
    readRepo.findUsoMensal.mockResolvedValue({
      clienteId: 'cli-1',
      voosMes: 5,
      levantamentosMes: 10,
      itensMes: 30,
      usuariosAtivos: 2,
    });
    readRepo.findQuotas.mockResolvedValue(
      new ClienteQuotas(
        {
          clienteId: 'cli-1',
          voosMes: 20,
          levantamentosMes: 40,
          itensMes: 100,
          usuariosAtivos: 5,
        },
        {},
      ),
    );

    const result = await useCase.execute();

    expect(result.clienteId).toBe('cli-1');
    expect(result.voosMes).toBe(5);
    expect(result.limites).toEqual({
      voosMes: 20,
      levantamentosMes: 40,
      itensMes: 100,
      usuariosAtivos: 5,
    });
  });

  it('deve retornar limites com todos valores null quando quotas não existem', async () => {
    readRepo.findUsoMensal.mockResolvedValue({
      clienteId: 'cli-1',
      voosMes: 1,
      levantamentosMes: 2,
      itensMes: 3,
      usuariosAtivos: 1,
    });
    readRepo.findQuotas.mockResolvedValue(null);

    const result = await useCase.execute();

    expect(result.limites).toEqual({
      voosMes: null,
      levantamentosMes: null,
      itensMes: null,
      usuariosAtivos: null,
    });
  });
});
