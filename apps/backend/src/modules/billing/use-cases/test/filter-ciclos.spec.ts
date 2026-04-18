import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { BillingCiclo } from '../../entities/billing';
import { BillingReadRepository } from '../../repositories/billing-read.repository';
import { FilterCiclos } from '../filter-ciclos';

describe('FilterCiclos', () => {
  let useCase: FilterCiclos;
  const readRepo = mock<BillingReadRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilterCiclos,
        { provide: BillingReadRepository, useValue: readRepo },
      ],
    }).compile();

    useCase = module.get<FilterCiclos>(FilterCiclos);
  });

  it('deve retornar ciclos do cliente', async () => {
    const ciclo = new BillingCiclo(
      {
        clienteId: 'cli-1',
        periodoInicio: new Date('2025-06-01'),
        periodoFim: new Date('2025-06-30'),
        status: 'aberto',
        valorExcedente: 0,
      },
      {},
    );
    readRepo.findCiclos.mockResolvedValue([ciclo]);

    const result = await useCase.execute('cli-1');

    expect(result.items).toHaveLength(1);
    expect(readRepo.findCiclos).toHaveBeenCalledWith('cli-1');
  });

  it('deve retornar lista vazia quando cliente não possui ciclos', async () => {
    readRepo.findCiclos.mockResolvedValue([]);

    const result = await useCase.execute('cli-sem-ciclos');

    expect(result.items).toEqual([]);
  });
});
