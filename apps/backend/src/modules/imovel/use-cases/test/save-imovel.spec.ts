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
    await useCase.execute('imovel-1', { quarteirao: 'Q03', bairro: 'Bairro X' } as any, TENANT);

    expect(quarteiraoWriteRepo.upsertMestreIfMissing).toHaveBeenCalledWith(
      TENANT,
      'Bairro X',
      'Q03',
    );
  });

  it('K.5 — quarteirao não presente no input → upsertMestreIfMissing NÃO chamado', async () => {
    await useCase.execute('imovel-1', { bairro: 'Outro' } as any, TENANT);

    expect(quarteiraoWriteRepo.upsertMestreIfMissing).not.toHaveBeenCalled();
  });

  it('K.5 — falha em upsertMestreIfMissing não quebra o save', async () => {
    quarteiraoWriteRepo.upsertMestreIfMissing.mockRejectedValueOnce(new Error('DB error'));

    const result = await useCase.execute('imovel-1', { quarteirao: 'Q04' } as any, TENANT);

    expect(result.imovel).toBeDefined();
  });

  it('imóvel não encontrado → lança erro', async () => {
    readRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute('inexistente', {}, TENANT)).rejects.toBeDefined();
    expect(writeRepo.save).not.toHaveBeenCalled();
  });

  it('IDOR — cliente-B não consegue editar imóvel de cliente-A', async () => {
    // Simula o comportamento do repositório: clienteId diferente → retorna null (filtro de tenant no WHERE)
    readRepo.findById.mockImplementation(async (_id, clienteId) => {
      return clienteId === TENANT ? { ...mockImovel } : null;
    });

    await expect(
      useCase.execute('imovel-1', {}, 'cliente-uuid-2'),
    ).rejects.toBeDefined();

    // Garante que o clienteId do tenant B foi repassado ao repositório (não ignorado)
    expect(readRepo.findById).toHaveBeenCalledWith('imovel-1', 'cliente-uuid-2');
    expect(writeRepo.save).not.toHaveBeenCalled();
  });
});
