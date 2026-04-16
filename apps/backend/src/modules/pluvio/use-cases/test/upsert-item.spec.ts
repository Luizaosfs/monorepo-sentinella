import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { expectHttpException } from '@test/utils/expect-http-exception';
import { mockRequest } from '@test/utils/user-helpers';

import { PluvioException } from '../../errors/pluvio.exception';
import { PluvioReadRepository } from '../../repositories/pluvio-read.repository';
import { PluvioWriteRepository } from '../../repositories/pluvio-write.repository';
import { UpsertItem } from '../upsert-item';
import { PluvioItemBuilder, PluvioRunBuilder } from './builders/pluvio.builder';

describe('UpsertItem', () => {
  let useCase: UpsertItem;
  const readRepo = mock<PluvioReadRepository>();
  const writeRepo = mock<PluvioWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpsertItem,
        { provide: PluvioReadRepository, useValue: readRepo },
        { provide: PluvioWriteRepository, useValue: writeRepo },
        { provide: 'REQUEST', useValue: mockRequest() },
      ],
    }).compile();

    useCase = module.get<UpsertItem>(UpsertItem);
  });

  it('deve criar/atualizar item vinculado a uma run existente', async () => {
    const run = new PluvioRunBuilder().build();
    const item = new PluvioItemBuilder().withRunId(run.id!).build();
    readRepo.findRunById.mockResolvedValue(run);
    writeRepo.upsertItem.mockResolvedValue(item);

    const result = await useCase.execute({
      runId: run.id!,
      precipitacao: 12,
      nivelRisco: 'medio',
    });

    expect(result.item).toEqual(item);
    expect(writeRepo.upsertItem).toHaveBeenCalled();
  });

  it('deve rejeitar se run não encontrada', async () => {
    readRepo.findRunById.mockResolvedValue(null);

    await expectHttpException(
      () =>
        useCase.execute({
          runId: '00000000-0000-4000-8000-000000000001',
          precipitacao: 1,
          nivelRisco: 'baixo',
        }),
      PluvioException.runNotFound(),
    );
    expect(writeRepo.upsertItem).not.toHaveBeenCalled();
  });
});
