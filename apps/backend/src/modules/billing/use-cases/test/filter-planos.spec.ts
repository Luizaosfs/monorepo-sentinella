import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { Plano } from '../../entities/billing';
import { BillingReadRepository } from '../../repositories/billing-read.repository';
import { FilterPlanos } from '../filter-planos';

describe('FilterPlanos', () => {
  let useCase: FilterPlanos;
  const readRepo = mock<BillingReadRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilterPlanos,
        { provide: BillingReadRepository, useValue: readRepo },
      ],
    }).compile();

    useCase = module.get<FilterPlanos>(FilterPlanos);
  });

  it('deve retornar lista de planos', async () => {
    const plano = new Plano(
      {
        nome: 'Pro',
        droneHabilitado: true,
        slaAvancado: true,
        integracoesHabilitadas: [],
        ativo: true,
        ordem: 1,
      },
      {},
    );
    readRepo.findPlanos.mockResolvedValue([plano]);

    const result = await useCase.execute();

    expect(result.items).toHaveLength(1);
    expect(result.items[0].nome).toBe('Pro');
  });

  it('deve retornar lista vazia quando não há planos', async () => {
    readRepo.findPlanos.mockResolvedValue([]);

    const result = await useCase.execute();

    expect(result.items).toEqual([]);
  });
});
