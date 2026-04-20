import { ForbiddenException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { expectHttpException } from '@test/utils/expect-http-exception';

import { SlaException } from '../../errors/sla.exception';
import { SlaReadRepository } from '../../repositories/sla-read.repository';
import { SlaWriteRepository } from '../../repositories/sla-write.repository';
import { DeleteFeriado } from '../delete-feriado';

describe('DeleteFeriado', () => {
  let useCase: DeleteFeriado;
  const readRepo = mock<SlaReadRepository>();
  const writeRepo = mock<SlaWriteRepository>();
  const req: any = { user: { isPlatformAdmin: true }, tenantId: null };

  beforeEach(async () => {
    jest.clearAllMocks();
    req.user = { isPlatformAdmin: true };
    req.tenantId = null;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteFeriado,
        { provide: SlaReadRepository, useValue: readRepo },
        { provide: SlaWriteRepository, useValue: writeRepo },
        { provide: REQUEST, useValue: req },
      ],
    }).compile();

    useCase = await module.resolve<DeleteFeriado>(DeleteFeriado);
  });

  it('deve rejeitar feriado não encontrado', async () => {
    readRepo.findFeriadoById.mockResolvedValue(null);

    await expectHttpException(
      () => useCase.execute('missing-id'),
      SlaException.feriadoNotFound(),
    );
    expect(writeRepo.deleteFeriado).not.toHaveBeenCalled();
  });

  it('deve rejeitar supervisor tentando deletar feriado de outro cliente (IDOR)', async () => {
    readRepo.findFeriadoById.mockResolvedValue({ id: 'f-1', clienteId: 'cliente-A' });

    req.user = { isPlatformAdmin: false };
    req.tenantId = 'cliente-B';

    await expect(useCase.execute('f-1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(writeRepo.deleteFeriado).not.toHaveBeenCalled();
  });

  it('deve permitir supervisor do mesmo cliente', async () => {
    readRepo.findFeriadoById.mockResolvedValue({ id: 'f-1', clienteId: 'cliente-A' });
    writeRepo.deleteFeriado.mockResolvedValue();

    req.user = { isPlatformAdmin: false };
    req.tenantId = 'cliente-A';

    const result = await useCase.execute('f-1');
    expect(result).toEqual({ deleted: true });
    expect(writeRepo.deleteFeriado).toHaveBeenCalledWith('f-1');
  });
});
