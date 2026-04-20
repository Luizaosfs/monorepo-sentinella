import { ForbiddenException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { NotificacaoReadRepository } from '../../repositories/notificacao-read.repository';
import { NotificacaoWriteRepository } from '../../repositories/notificacao-write.repository';
import { DeleteCaso } from '../delete-caso';

describe('DeleteCaso', () => {
  let useCase: DeleteCaso;
  const readRepo = mock<NotificacaoReadRepository>();
  const writeRepo = mock<NotificacaoWriteRepository>();
  const req: any = { user: { isPlatformAdmin: true }, tenantId: null };

  beforeEach(async () => {
    jest.clearAllMocks();
    req.user = { isPlatformAdmin: true };
    req.tenantId = null;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteCaso,
        { provide: NotificacaoReadRepository, useValue: readRepo },
        { provide: NotificacaoWriteRepository, useValue: writeRepo },
        { provide: REQUEST, useValue: req },
      ],
    }).compile();

    useCase = await module.resolve<DeleteCaso>(DeleteCaso);
  });

  it('deve rejeitar supervisor tentando deletar caso de outro cliente (IDOR)', async () => {
    readRepo.findCasoById.mockResolvedValue({ clienteId: 'cliente-A' } as any);

    req.user = { isPlatformAdmin: false };
    req.tenantId = 'cliente-B';

    await expect(useCase.execute('caso-uuid')).rejects.toBeInstanceOf(ForbiddenException);
    expect(writeRepo.deleteCaso).not.toHaveBeenCalled();
  });

  it('deve permitir supervisor do mesmo cliente', async () => {
    readRepo.findCasoById.mockResolvedValue({ clienteId: 'cliente-A' } as any);
    writeRepo.deleteCaso.mockResolvedValue();

    req.user = { isPlatformAdmin: false };
    req.tenantId = 'cliente-A';

    await useCase.execute('caso-uuid');
    expect(writeRepo.deleteCaso).toHaveBeenCalledWith('caso-uuid');
  });

  it('deve permitir admin em qualquer cliente', async () => {
    readRepo.findCasoById.mockResolvedValue({ clienteId: 'cliente-A' } as any);
    writeRepo.deleteCaso.mockResolvedValue();

    await useCase.execute('caso-uuid');
    expect(writeRepo.deleteCaso).toHaveBeenCalledWith('caso-uuid');
  });
});
