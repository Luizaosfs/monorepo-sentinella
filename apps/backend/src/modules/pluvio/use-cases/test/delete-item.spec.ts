import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { expectHttpException } from '@test/utils/expect-http-exception';

import { PluvioException } from '../../errors/pluvio.exception';
import { PluvioReadRepository } from '../../repositories/pluvio-read.repository';
import { PluvioWriteRepository } from '../../repositories/pluvio-write.repository';
import { DeleteItem } from '../delete-item';
import { PluvioItemBuilder } from './builders/pluvio.builder';

describe('DeleteItem', () => {
  let useCase: DeleteItem;
  const readRepo = mock<PluvioReadRepository>();
  const writeRepo = mock<PluvioWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteItem,
        { provide: PluvioReadRepository, useValue: readRepo },
        { provide: PluvioWriteRepository, useValue: writeRepo },
      ],
    }).compile();

    useCase = module.get<DeleteItem>(DeleteItem);
  });

  it('deve deletar item existente', async () => {
    const item = new PluvioItemBuilder().build();
    readRepo.findItemById.mockResolvedValue(item);
    writeRepo.deleteItem.mockResolvedValue();

    await useCase.execute(item.id!);

    expect(writeRepo.deleteItem).toHaveBeenCalledWith(item.id);
  });

  it('deve rejeitar item não encontrado', async () => {
    readRepo.findItemById.mockResolvedValue(null);

    await expectHttpException(() => useCase.execute('missing-id'), PluvioException.itemNotFound());
    expect(writeRepo.deleteItem).not.toHaveBeenCalled();
  });
});
