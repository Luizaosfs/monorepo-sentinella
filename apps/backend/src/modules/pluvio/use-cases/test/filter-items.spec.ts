import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { expectHttpException } from '@test/utils/expect-http-exception';

import { PluvioException } from '../../errors/pluvio.exception';
import { PluvioReadRepository } from '../../repositories/pluvio-read.repository';
import { FilterItems } from '../filter-items';
import { PluvioItemBuilder, PluvioRunBuilder } from './builders/pluvio.builder';

describe('FilterItems', () => {
  let useCase: FilterItems;
  const readRepo = mock<PluvioReadRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [FilterItems, { provide: PluvioReadRepository, useValue: readRepo }],
    }).compile();

    useCase = module.get<FilterItems>(FilterItems);
  });

  it('deve retornar itens de uma run', async () => {
    const run = new PluvioRunBuilder().build();
    const items = [new PluvioItemBuilder().withRunId(run.id!).build()];
    readRepo.findRunById.mockResolvedValue(run);
    readRepo.findItemsByRunId.mockResolvedValue(items);

    const result = await useCase.execute(run.id!);

    expect(result.items).toEqual(items);
    expect(readRepo.findItemsByRunId).toHaveBeenCalledWith(run.id);
  });

  it('deve rejeitar run não encontrada', async () => {
    readRepo.findRunById.mockResolvedValue(null);

    await expectHttpException(() => useCase.execute('missing-run'), PluvioException.runNotFound());
    expect(readRepo.findItemsByRunId).not.toHaveBeenCalled();
  });
});
