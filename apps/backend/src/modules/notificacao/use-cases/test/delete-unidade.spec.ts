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
  const req: any = { accessScope: { tenantId: null, clienteIdsPermitidos: null } };

  beforeEach(async () => {
    jest.clearAllMocks();
    req.accessScope = { tenantId: null, clienteIdsPermitidos: null };
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

  it('IDOR: supervisor de cliente-B não encontra unidade de cliente-A (repo retorna null → notFound)', async () => {
    // Simula filtro de tenant do repositório: cliente-B não vê unidade de cliente-A
    readRepo.findUnidadeById.mockImplementation(async (_id, clienteId) =>
      clienteId === 'cliente-A' ? ({ clienteId: 'cliente-A' } as any) : null,
    );

    req.accessScope = { tenantId: 'cliente-B', clienteIdsPermitidos: ['cliente-B'] };

    await expect(useCase.execute('unidade-uuid')).rejects.toBeDefined();
    expect(writeRepo.deleteUnidade).not.toHaveBeenCalled();
  });

  it('deve permitir supervisor do mesmo cliente', async () => {
    readRepo.findUnidadeById.mockResolvedValue({ clienteId: 'cliente-A' } as any);
    writeRepo.deleteUnidade.mockResolvedValue();

    req.accessScope = { tenantId: 'cliente-A', clienteIdsPermitidos: ['cliente-A'] };

    await useCase.execute('unidade-uuid');
    expect(writeRepo.deleteUnidade).toHaveBeenCalledWith('unidade-uuid');
  });
});
