import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { LevantamentoReadRepository } from '../../repositories/levantamento-read.repository';

import { FilterLevantamento } from '../filter-levantamento';
import { LevantamentoBuilder } from './builders/levantamento.builder';

describe('FilterLevantamento', () => {
  let useCase: FilterLevantamento;
  const readRepo = mock<LevantamentoReadRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilterLevantamento,
        { provide: LevantamentoReadRepository, useValue: readRepo },
      ],
    }).compile();

    useCase = module.get<FilterLevantamento>(FilterLevantamento);
  });

  it('deve delegar ao repository.findAll e retornar { levantamentos }', async () => {
    const list = [
      new LevantamentoBuilder().withId('l1').build(),
      new LevantamentoBuilder().withId('l2').build(),
    ];
    readRepo.findAll.mockResolvedValue(list);

    const filters = { clienteId: '00000000-0000-4000-8000-000000000001' };
    const result = await useCase.execute(filters as any);

    expect(result.levantamentos).toBe(list);
    expect(readRepo.findAll).toHaveBeenCalledWith(filters);
  });
});
