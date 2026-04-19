import { Test, TestingModule } from '@nestjs/testing';

import { ListItensByRecorrencia } from '../list-itens-by-recorrencia';

describe('ListItensByRecorrencia', () => {
  let useCase: ListItensByRecorrencia;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ListItensByRecorrencia],
    }).compile();

    useCase = module.get<ListItensByRecorrencia>(ListItensByRecorrencia);
  });

  it('retorna array vazio (deprecated — sem consumidor de dados real)', async () => {
    const result = await useCase.execute('qualquer-id');
    expect(result).toEqual([]);
  });
});
