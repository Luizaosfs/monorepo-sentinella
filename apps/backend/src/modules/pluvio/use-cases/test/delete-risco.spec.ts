import { ForbiddenException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { expectHttpException } from '@test/utils/expect-http-exception';

import { PluvioRisco } from '../../entities/pluvio';
import { PluvioException } from '../../errors/pluvio.exception';
import { PluvioReadRepository } from '../../repositories/pluvio-read.repository';
import { PluvioWriteRepository } from '../../repositories/pluvio-write.repository';
import { DeleteRisco } from '../delete-risco';

describe('DeleteRisco', () => {
  let useCase: DeleteRisco;
  const readRepo = mock<PluvioReadRepository>();
  const writeRepo = mock<PluvioWriteRepository>();
  const req: any = { accessScope: { clienteIdsPermitidos: null } };

  const makeRisco = () =>
    new PluvioRisco(
      {
        regiaoId: 'regiao-uuid-1',
        nivel: 'alto',
        precipitacaoAcumulada: 100,
        dataReferencia: new Date('2024-06-15'),
      },
      { id: 'risco-uuid-1' },
    );

  beforeEach(async () => {
    jest.clearAllMocks();
    req.accessScope = { clienteIdsPermitidos: null };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteRisco,
        { provide: PluvioReadRepository, useValue: readRepo },
        { provide: PluvioWriteRepository, useValue: writeRepo },
        { provide: REQUEST, useValue: req },
      ],
    }).compile();

    useCase = await module.resolve<DeleteRisco>(DeleteRisco);
  });

  it('deve deletar risco existente (admin)', async () => {
    const risco = makeRisco();
    readRepo.findRiscoById.mockResolvedValue(risco);
    readRepo.findClienteIdByRegiaoId.mockResolvedValue('cliente-A');
    writeRepo.deleteRisco.mockResolvedValue();

    await useCase.execute(risco.id!);

    expect(writeRepo.deleteRisco).toHaveBeenCalledWith(risco.id);
  });

  it('deve rejeitar risco não encontrado', async () => {
    readRepo.findRiscoById.mockResolvedValue(null);

    await expectHttpException(() => useCase.execute('missing-id'), PluvioException.notFound());
    expect(writeRepo.deleteRisco).not.toHaveBeenCalled();
  });

  it('deve rejeitar supervisor tentando deletar risco de regiao de outro cliente (IDOR)', async () => {
    const risco = makeRisco();
    readRepo.findRiscoById.mockResolvedValue(risco);
    readRepo.findClienteIdByRegiaoId.mockResolvedValue('cliente-A');

    req.accessScope = { clienteIdsPermitidos: ['cliente-B'] };

    await expect(useCase.execute(risco.id!)).rejects.toBeInstanceOf(ForbiddenException);
    expect(writeRepo.deleteRisco).not.toHaveBeenCalled();
  });
});
