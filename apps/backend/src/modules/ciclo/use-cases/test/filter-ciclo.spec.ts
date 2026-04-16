import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { FilterCicloInput } from '../../dtos/filter-ciclo.input';
import { CicloReadRepository } from '../../repositories/ciclo-read.repository';

import { FilterCiclo } from '../filter-ciclo';
import { CicloBuilder } from './builders/ciclo.builder';

describe('FilterCiclo', () => {
  let useCase: FilterCiclo;
  const readRepo = mock<CicloReadRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [FilterCiclo, { provide: CicloReadRepository, useValue: readRepo }],
    }).compile();
    useCase = module.get<FilterCiclo>(FilterCiclo);
  });

  it('deve delegar ao repository.findAll e retornar { ciclos }', async () => {
    const lista = [new CicloBuilder().build(), new CicloBuilder().withId('c2').withNumero(2).build()];
    readRepo.findAll.mockResolvedValue(lista);

    const filters = { ano: 2024 } as FilterCicloInput;
    const result = await useCase.execute(filters);

    expect(readRepo.findAll).toHaveBeenCalledWith(filters);
    expect(result).toEqual({ ciclos: lista });
  });
});
