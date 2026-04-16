import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { FocoRiscoReadRepository } from '../../repositories/foco-risco-read.repository';

import { FilterFocoRisco } from '../filter-foco-risco';
import { FocoRiscoBuilder } from './builders/foco-risco.builder';

describe('FilterFocoRisco', () => {
  let useCase: FilterFocoRisco;
  const readRepo = mock<FocoRiscoReadRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilterFocoRisco,
        { provide: FocoRiscoReadRepository, useValue: readRepo },
      ],
    }).compile();

    useCase = module.get<FilterFocoRisco>(FilterFocoRisco);
  });

  it('deve retornar lista de focos filtrados', async () => {
    const focos = [
      new FocoRiscoBuilder().withId('f1').withStatus('suspeita').build(),
      new FocoRiscoBuilder().withId('f2').withStatus('em_triagem').build(),
    ];
    readRepo.findAll.mockResolvedValue(focos);

    const result = await useCase.execute({ clienteId: 'cliente-uuid-1' });

    expect(result.focos).toHaveLength(2);
    expect(readRepo.findAll).toHaveBeenCalledWith({ clienteId: 'cliente-uuid-1' });
  });

  it('deve retornar lista vazia quando não há focos', async () => {
    readRepo.findAll.mockResolvedValue([]);

    const result = await useCase.execute({});

    expect(result.focos).toHaveLength(0);
  });
});
