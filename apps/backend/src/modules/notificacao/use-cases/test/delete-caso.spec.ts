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
  const req: any = { accessScope: { tenantId: null, clienteIdsPermitidos: null } };

  beforeEach(async () => {
    jest.clearAllMocks();
    req.accessScope = { tenantId: null, clienteIdsPermitidos: null };
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

  it('IDOR: supervisor de cliente-B não encontra caso de cliente-A (repo retorna null → notFound)', async () => {
    // Simula filtro de tenant do repositório: cliente-B não vê caso de cliente-A
    readRepo.findCasoById.mockImplementation(async (_id, clienteId) =>
      clienteId === 'cliente-A' ? ({ clienteId: 'cliente-A' } as any) : null,
    );

    req.accessScope = { tenantId: 'cliente-B', clienteIdsPermitidos: ['cliente-B'] };

    await expect(useCase.execute('caso-uuid')).rejects.toBeDefined();
    expect(writeRepo.deleteCaso).not.toHaveBeenCalled();
  });

  it('deve permitir supervisor do mesmo cliente', async () => {
    readRepo.findCasoById.mockResolvedValue({ clienteId: 'cliente-A' } as any);
    writeRepo.deleteCaso.mockResolvedValue();

    req.accessScope = { tenantId: 'cliente-A', clienteIdsPermitidos: ['cliente-A'] };

    await useCase.execute('caso-uuid');
    expect(writeRepo.deleteCaso).toHaveBeenCalledWith('caso-uuid');
  });

  it('deve permitir admin em qualquer cliente (tenantId null)', async () => {
    readRepo.findCasoById.mockResolvedValue({ clienteId: 'cliente-A' } as any);
    writeRepo.deleteCaso.mockResolvedValue();

    await useCase.execute('caso-uuid');
    expect(writeRepo.deleteCaso).toHaveBeenCalledWith('caso-uuid');
  });
});
