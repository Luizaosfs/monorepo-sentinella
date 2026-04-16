import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { expectHttpException } from '@test/utils/expect-http-exception';

import { PluvioException } from '../../errors/pluvio.exception';
import { PluvioReadRepository } from '../../repositories/pluvio-read.repository';
import { PluvioWriteRepository } from '../../repositories/pluvio-write.repository';
import { UpdateRunTotal } from '../update-run-total';
import { PluvioRunBuilder } from './builders/pluvio.builder';

describe('UpdateRunTotal', () => {
  let useCase: UpdateRunTotal;
  const readRepo = mock<PluvioReadRepository>();
  const writeRepo = mock<PluvioWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateRunTotal,
        { provide: PluvioReadRepository, useValue: readRepo },
        { provide: PluvioWriteRepository, useValue: writeRepo },
      ],
    }).compile();

    useCase = module.get<UpdateRunTotal>(UpdateRunTotal);
  });

  it('deve atualizar total da run', async () => {
    const run = new PluvioRunBuilder().withTotal(10).build();
    readRepo.findRunById.mockResolvedValue(run);
    writeRepo.saveRun.mockResolvedValue();

    const result = await useCase.execute(run.id!, 99);

    expect(result.run.total).toBe(99);
    expect(writeRepo.saveRun).toHaveBeenCalledWith(expect.objectContaining({ total: 99 }));
  });

  it('deve rejeitar run não encontrada', async () => {
    readRepo.findRunById.mockResolvedValue(null);

    await expectHttpException(() => useCase.execute('missing-id', 1), PluvioException.runNotFound());
    expect(writeRepo.saveRun).not.toHaveBeenCalled();
  });
});
