import { ForbiddenException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
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
  const req: any = { accessScope: { clienteIdsPermitidos: null } };

  beforeEach(async () => {
    jest.clearAllMocks();
    req.accessScope = { clienteIdsPermitidos: null };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteRun,
        { provide: PluvioReadRepository, useValue: readRepo },
        { provide: PluvioWriteRepository, useValue: writeRepo },
        { provide: REQUEST, useValue: req },
      ],
    }).compile();

    useCase = await module.resolve<DeleteRun>(DeleteRun);
  });

  it('deve deletar run existente (admin)', async () => {
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

  it('deve rejeitar supervisor tentando deletar run de outro cliente (IDOR)', async () => {
    const run = new PluvioRunBuilder().build();
    // run pertence ao cliente A; tenantId do request = B
    (run as any).props = { ...(run as any).props, clienteId: 'cliente-A' };
    readRepo.findRunById.mockResolvedValue(run);

    req.accessScope = { clienteIdsPermitidos: ['cliente-B'] };

    await expect(useCase.execute(run.id!)).rejects.toBeInstanceOf(ForbiddenException);
    expect(writeRepo.deleteRun).not.toHaveBeenCalled();
  });

  it('deve permitir supervisor do mesmo cliente', async () => {
    const run = new PluvioRunBuilder().build();
    (run as any).props = { ...(run as any).props, clienteId: 'cliente-A' };
    readRepo.findRunById.mockResolvedValue(run);
    writeRepo.deleteRun.mockResolvedValue();

    req.accessScope = { clienteIdsPermitidos: ['cliente-A'] };

    await useCase.execute(run.id!);
    expect(writeRepo.deleteRun).toHaveBeenCalledWith(run.id);
  });
});
