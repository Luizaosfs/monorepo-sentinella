import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { expectHttpException } from '@test/utils/expect-http-exception';

import { PluvioException } from '../../errors/pluvio.exception';
import { PluvioReadRepository } from '../../repositories/pluvio-read.repository';
import { PluvioWriteRepository } from '../../repositories/pluvio-write.repository';
import { DeleteRun } from '../delete-run';
import { PluvioRunBuilder } from './builders/pluvio.builder';

describe('DeleteRun', () => {
  let useCase: DeleteRun;
  const readRepo = mock<PluvioReadRepository>();
  const writeRepo = mock<PluvioWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteRun,
        { provide: PluvioReadRepository, useValue: readRepo },
        { provide: PluvioWriteRepository, useValue: writeRepo },
      ],
    }).compile();

    useCase = module.get<DeleteRun>(DeleteRun);
  });

  it('deve deletar run existente', async () => {
    const run = new PluvioRunBuilder().build();
    readRepo.findRunById.mockResolvedValue(run);
    writeRepo.deleteRun.mockResolvedValue();

    await useCase.execute(run.id!);

    expect(writeRepo.deleteRun).toHaveBeenCalledWith(run.id);
  });

  it('deve rejeitar run não encontrada', async () => {
    readRepo.findRunById.mockResolvedValue(null);

    await expectHttpException(() => useCase.execute('missing-id'), PluvioException.runNotFound());
    expect(writeRepo.deleteRun).not.toHaveBeenCalled();
  });
});
