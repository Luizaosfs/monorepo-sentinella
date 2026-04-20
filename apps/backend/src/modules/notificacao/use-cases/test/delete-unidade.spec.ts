import { ForbiddenException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { NotificacaoReadRepository } from '../../repositories/notificacao-read.repository';
import { NotificacaoWriteRepository } from '../../repositories/notificacao-write.repository';
import { DeleteUnidade } from '../delete-unidade';

describe('DeleteUnidade', () => {
  let useCase: DeleteUnidade;
  const readRepo = mock<NotificacaoReadRepository>();
  const writeRepo = mock<NotificacaoWriteRepository>();
  const req: any = { user: { isPlatformAdmin: true }, tenantId: null };

  beforeEach(async () => {
    jest.clearAllMocks();
    req.user = { isPlatformAdmin: true };
    req.tenantId = null;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteUnidade,
        { provide: NotificacaoReadRepository, useValue: readRepo },
        { provide: NotificacaoWriteRepository, useValue: writeRepo },
        { provide: REQUEST, useValue: req },
      ],
    }).compile();

    useCase = await module.resolve<DeleteUnidade>(DeleteUnidade);
  });

  it('deve rejeitar supervisor tentando deletar unidade de outro cliente (IDOR)', async () => {
    readRepo.findUnidadeById.mockResolvedValue({ clienteId: 'cliente-A' } as any);

    req.user = { isPlatformAdmin: false };
    req.tenantId = 'cliente-B';

    await expect(useCase.execute('unidade-uuid')).rejects.toBeInstanceOf(ForbiddenException);
    expect(writeRepo.deleteUnidade).not.toHaveBeenCalled();
  });

  it('deve permitir supervisor do mesmo cliente', async () => {
    readRepo.findUnidadeById.mockResolvedValue({ clienteId: 'cliente-A' } as any);
    writeRepo.deleteUnidade.mockResolvedValue();

    req.user = { isPlatformAdmin: false };
    req.tenantId = 'cliente-A';

    await useCase.execute('unidade-uuid');
    expect(writeRepo.deleteUnidade).toHaveBeenCalledWith('unidade-uuid');
  });
});
