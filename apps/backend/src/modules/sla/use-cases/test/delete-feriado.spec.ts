import { ForbiddenException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { mockRequest } from '@test/utils/user-helpers';

import { expectHttpException } from '@test/utils/expect-http-exception';

import { SlaException } from '../../errors/sla.exception';
import { SlaReadRepository } from '../../repositories/sla-read.repository';
import { SlaWriteRepository } from '../../repositories/sla-write.repository';
import { DeleteFeriado } from '../delete-feriado';

describe('DeleteFeriado', () => {
  let useCase: DeleteFeriado;
  const readRepo = mock<SlaReadRepository>();
  const writeRepo = mock<SlaWriteRepository>();
  const req = mockRequest({
    accessScope: {
      kind: 'platform' as const,
      userId: 'admin-id',
      papeis: ['admin'] as any,
      isAdmin: true,
      tenantId: null,
      clienteIdsPermitidos: null,
      agrupamentoId: null,
    },
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    req['accessScope'] = {
      kind: 'platform' as const,
      userId: 'admin-id',
      papeis: ['admin'] as any,
      isAdmin: true,
      tenantId: null,
      clienteIdsPermitidos: null,
      agrupamentoId: null,
    };
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

    req['accessScope'] = {
      kind: 'municipal' as const,
      userId: 'user-id',
      papeis: ['supervisor'] as any,
      isAdmin: false,
      tenantId: 'cliente-B',
      clienteIdsPermitidos: ['cliente-B'] as [string],
      agrupamentoId: null,
    };

    await expect(useCase.execute('f-1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(writeRepo.deleteFeriado).not.toHaveBeenCalled();
  });

  it('deve permitir supervisor do mesmo cliente', async () => {
    readRepo.findFeriadoById.mockResolvedValue({ id: 'f-1', clienteId: 'cliente-A' });
    writeRepo.deleteFeriado.mockResolvedValue();

    req['accessScope'] = {
      kind: 'municipal' as const,
      userId: 'user-id',
      papeis: ['supervisor'] as any,
      isAdmin: false,
      tenantId: 'cliente-A',
      clienteIdsPermitidos: ['cliente-A'] as [string],
      agrupamentoId: null,
    };

    const result = await useCase.execute('f-1');
    expect(result).toEqual({ deleted: true });
    expect(writeRepo.deleteFeriado).toHaveBeenCalledWith('f-1');
  });
});
