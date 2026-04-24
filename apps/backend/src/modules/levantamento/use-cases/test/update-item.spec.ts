import { ForbiddenException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { mockRequest } from '@test/utils/user-helpers';
import { LevantamentoReadRepository } from '../../repositories/levantamento-read.repository';
import { LevantamentoWriteRepository } from '../../repositories/levantamento-write.repository';
import { UpdateItemBody } from '../../dtos/update-item.body';
import { UpdateItem } from '../update-item';

const TENANT = 'test-cliente-id';
const mockItem = { id: 'item-1', clienteId: TENANT } as any;

describe('UpdateItem', () => {
  let useCase: UpdateItem;
  const readRepo = mock<LevantamentoReadRepository>();
  const writeRepo = mock<LevantamentoWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    readRepo.findItemById.mockResolvedValue(mockItem);
    writeRepo.updateItem.mockResolvedValue(undefined as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateItem,
        { provide: LevantamentoReadRepository, useValue: readRepo },
        { provide: LevantamentoWriteRepository, useValue: writeRepo },
        { provide: REQUEST, useValue: mockRequest({ tenantId: TENANT }) },
      ],
    }).compile();

    useCase = module.get<UpdateItem>(UpdateItem);
  });

  // Base tests
  it('item não encontrado → itemNotFound()', async () => {
    readRepo.findItemById.mockResolvedValue(null);

    await expect(useCase.execute('inexistente', {})).rejects.toBeDefined();
    expect(writeRepo.updateItem).not.toHaveBeenCalled();
  });

  it('item de outro tenant → assertTenantOwnership throw', async () => {
    readRepo.findItemById.mockResolvedValue({ id: 'item-1', clienteId: 'outro-tenant' } as any);

    await expect(useCase.execute('item-1', {})).rejects.toBeDefined();
    expect(writeRepo.updateItem).not.toHaveBeenCalled();
  });

  // Guard G.1 tests
  it('rejeita alteração de latitude (campo imutável)', async () => {
    await expect(
      useCase.execute('item-1', { latitude: -20.123 } as UpdateItemBody),
    ).rejects.toThrow(ForbiddenException);

    expect(writeRepo.updateItem).not.toHaveBeenCalled();
  });

  it('rejeita alteração de imageUrl (campo imutável)', async () => {
    await expect(
      useCase.execute('item-1', { imageUrl: 'https://evil.com/x.jpg' } as UpdateItemBody),
    ).rejects.toThrow(ForbiddenException);

    expect(writeRepo.updateItem).not.toHaveBeenCalled();
  });

  it('rejeita alteração de scoreFinal (campo imutável)', async () => {
    await expect(
      useCase.execute('item-1', { scoreFinal: 0.99 } as UpdateItemBody),
    ).rejects.toThrow(ForbiddenException);

    expect(writeRepo.updateItem).not.toHaveBeenCalled();
  });

  it('lista todos os campos violados na mensagem de erro', async () => {
    try {
      await useCase.execute('item-1', {
        latitude: -20.1,
        longitude: -51.1,
        imageUrl: 'https://evil.com/x.jpg',
      } as UpdateItemBody);
      fail('deveria ter lançado');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      const msg = (err as ForbiddenException).message;
      expect(msg).toContain('latitude');
      expect(msg).toContain('longitude');
      expect(msg).toContain('imageUrl');
    }
  });

  it('aceita update de campos não-imutáveis e persiste', async () => {
    await useCase.execute('item-1', {
      item: 'pneu',
      risco: 'alto',
      prioridade: 'P2',
    } as UpdateItemBody);

    expect(writeRepo.updateItem).toHaveBeenCalledWith(
      'item-1',
      expect.objectContaining({ item: 'pneu', risco: 'alto', prioridade: 'P2' }),
    );
  });
});
