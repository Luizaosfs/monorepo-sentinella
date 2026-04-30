import { ForbiddenException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { expectHttpException } from '@test/utils/expect-http-exception';

import { PluvioException } from '../../errors/pluvio.exception';
import { PluvioReadRepository } from '../../repositories/pluvio-read.repository';
import { PluvioWriteRepository } from '../../repositories/pluvio-write.repository';
import { DeleteItem } from '../delete-item';
import { PluvioItemBuilder, PluvioRunBuilder } from './builders/pluvio.builder';

describe('DeleteItem', () => {
  let useCase: DeleteItem;
  const readRepo = mock<PluvioReadRepository>();
  const writeRepo = mock<PluvioWriteRepository>();
  const req: any = { accessScope: { clienteIdsPermitidos: null } };

  beforeEach(async () => {
    jest.clearAllMocks();
    req.accessScope = { clienteIdsPermitidos: null };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteItem,
        { provide: PluvioReadRepository, useValue: readRepo },
        { provide: PluvioWriteRepository, useValue: writeRepo },
        { provide: REQUEST, useValue: req },
      ],
    }).compile();

    useCase = await module.resolve<DeleteItem>(DeleteItem);
  });

  it('deve deletar item existente (admin)', async () => {
    const item = new PluvioItemBuilder().build();
    const run = new PluvioRunBuilder().build();
    readRepo.findItemById.mockResolvedValue(item);
    readRepo.findRunById.mockResolvedValue(run);
    writeRepo.deleteItem.mockResolvedValue();

    await useCase.execute(item.id!);

    expect(writeRepo.deleteItem).toHaveBeenCalledWith(item.id);
  });

  it('deve rejeitar item não encontrado', async () => {
    readRepo.findItemById.mockResolvedValue(null);

    await expectHttpException(() => useCase.execute('missing-id'), PluvioException.itemNotFound());
    expect(writeRepo.deleteItem).not.toHaveBeenCalled();
  });

  it('deve rejeitar supervisor tentando deletar item cuja run pertence a outro cliente (IDOR)', async () => {
    const item = new PluvioItemBuilder().build();
    const run = new PluvioRunBuilder().build();
    (run as any).props = { ...(run as any).props, clienteId: 'cliente-A' };
    readRepo.findItemById.mockResolvedValue(item);
    readRepo.findRunById.mockResolvedValue(run);

    req.accessScope = { clienteIdsPermitidos: ['cliente-B'] };

    await expect(useCase.execute(item.id!)).rejects.toBeInstanceOf(ForbiddenException);
    expect(writeRepo.deleteItem).not.toHaveBeenCalled();
  });
});
