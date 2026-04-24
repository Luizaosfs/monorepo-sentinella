import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { QuarteiraoWriteRepository } from '../../../quarteirao/repositories/quarteirao-write.repository';
import { ImovelException } from '../../errors/imovel.exception';
import { ImovelReadRepository } from '../../repositories/imovel-read.repository';
import { ImovelWriteRepository } from '../../repositories/imovel-write.repository';
import { SaveImovel } from '../save-imovel';

const TENANT = 'cliente-uuid-1';

const mockImovel = {
  id: 'imovel-1',
  clienteId: TENANT,
  quarteirao: undefined as string | undefined,
} as any;

describe('SaveImovel — K.5 sync quarteirao mestre', () => {
  let useCase: SaveImovel;
  const readRepo = mock<ImovelReadRepository>();
  const writeRepo = mock<ImovelWriteRepository>();
  const quarteiraoWriteRepo = mock<QuarteiraoWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    readRepo.findById.mockResolvedValue({ ...mockImovel });
    writeRepo.save.mockResolvedValue(undefined as any);
    quarteiraoWriteRepo.upsertMestreIfMissing.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaveImovel,
        { provide: ImovelReadRepository, useValue: readRepo },
        { provide: ImovelWriteRepository, useValue: writeRepo },
        { provide: QuarteiraoWriteRepository, useValue: quarteiraoWriteRepo },
      ],
    }).compile();

    useCase = module.get<SaveImovel>(SaveImovel);
  });

  it('K.5 — quarteirao no input → upsertMestreIfMissing chamado', async () => {
    await useCase.execute('imovel-1', { quarteirao: 'Q03', bairro: 'Bairro X' } as any);

    expect(quarteiraoWriteRepo.upsertMestreIfMissing).toHaveBeenCalledWith(
      TENANT,
      'Bairro X',
      'Q03',
    );
  });

  it('K.5 — quarteirao não presente no input → upsertMestreIfMissing NÃO chamado', async () => {
    await useCase.execute('imovel-1', { bairro: 'Outro' } as any);

    expect(quarteiraoWriteRepo.upsertMestreIfMissing).not.toHaveBeenCalled();
  });

  it('K.5 — falha em upsertMestreIfMissing não quebra o save', async () => {
    quarteiraoWriteRepo.upsertMestreIfMissing.mockRejectedValueOnce(new Error('DB error'));

    const result = await useCase.execute('imovel-1', { quarteirao: 'Q04' } as any);

    expect(result.imovel).toBeDefined();
  });

  it('imóvel não encontrado → lança erro', async () => {
    readRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('inexistente', {})).rejects.toBeDefined();
    expect(writeRepo.save).not.toHaveBeenCalled();
  });
});
