import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { mockRequest } from '@test/utils/user-helpers';
import { CloudinaryService } from '../../../cloudinary/cloudinary.service';
import { LevantamentoReadRepository } from '../../repositories/levantamento-read.repository';
import { LevantamentoWriteRepository } from '../../repositories/levantamento-write.repository';
import { DeleteItem } from '../delete-item';

const TENANT = 'cliente-uuid-1';

const mockItemBase = {
  id: 'item-1',
  clienteId: TENANT,
  imagePublicId: undefined as string | undefined,
  imageUrl: undefined as string | undefined,
};

describe('DeleteItem — K.6 registro de órfão Cloudinary', () => {
  let useCase: DeleteItem;
  const readRepo = mock<LevantamentoReadRepository>();
  const writeRepo = mock<LevantamentoWriteRepository>();
  const cloudinaryService = mock<CloudinaryService>();

  beforeEach(async () => {
    jest.clearAllMocks();
    writeRepo.deleteItem.mockResolvedValue(undefined as any);
    cloudinaryService.registrarOrfao.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteItem,
        { provide: LevantamentoReadRepository, useValue: readRepo },
        { provide: LevantamentoWriteRepository, useValue: writeRepo },
        { provide: CloudinaryService, useValue: cloudinaryService },
        { provide: REQUEST, useValue: mockRequest({ tenantId: TENANT }) },
      ],
    }).compile();

    useCase = module.get<DeleteItem>(DeleteItem);
  });

  it('item não encontrado → lança erro sem deletar', async () => {
    readRepo.findItemById.mockResolvedValue(null);

    await expect(useCase.execute('inexistente')).rejects.toBeDefined();
    expect(writeRepo.deleteItem).not.toHaveBeenCalled();
  });

  it('K.6 — imagePublicId presente → registrarOrfao chamado com args corretos', async () => {
    readRepo.findItemById.mockResolvedValue({
      ...mockItemBase,
      imagePublicId: 'sentinella/abc/xyz',
      imageUrl: 'https://res.cloudinary.com/abc/xyz.jpg',
    } as any);

    await useCase.execute('item-1');

    expect(cloudinaryService.registrarOrfao).toHaveBeenCalledWith(
      'sentinella/abc/xyz',
      'https://res.cloudinary.com/abc/xyz.jpg',
      'levantamento_itens',
      'item-1',
      TENANT,
    );
  });

  it('K.6 — imagePublicId ausente → registrarOrfao NÃO chamado', async () => {
    readRepo.findItemById.mockResolvedValue({ ...mockItemBase } as any);

    await useCase.execute('item-1');

    expect(cloudinaryService.registrarOrfao).not.toHaveBeenCalled();
  });

  it('K.6 — falha em registrarOrfao não quebra o delete', async () => {
    readRepo.findItemById.mockResolvedValue({
      ...mockItemBase,
      imagePublicId: 'sentinella/fail/img',
    } as any);
    cloudinaryService.registrarOrfao.mockRejectedValueOnce(new Error('Cloudinary down'));

    await expect(useCase.execute('item-1')).resolves.toBeUndefined();
    expect(writeRepo.deleteItem).toHaveBeenCalledWith('item-1');
  });
});
