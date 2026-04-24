import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { mockRequest } from '@test/utils/user-helpers';
import { QuarteiraoWriteRepository } from '../../../quarteirao/repositories/quarteirao-write.repository';
import { ImovelWriteRepository } from '../../repositories/imovel-write.repository';
import { CreateImovel } from '../create-imovel';

const TENANT = 'cliente-uuid-1';

describe('CreateImovel — K.5 sync quarteirao mestre', () => {
  let useCase: CreateImovel;
  const writeRepo = mock<ImovelWriteRepository>();
  const quarteiraoWriteRepo = mock<QuarteiraoWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    writeRepo.create.mockResolvedValue({ id: 'imovel-1', clienteId: TENANT } as any);
    quarteiraoWriteRepo.upsertMestreIfMissing.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateImovel,
        { provide: ImovelWriteRepository, useValue: writeRepo },
        { provide: QuarteiraoWriteRepository, useValue: quarteiraoWriteRepo },
        { provide: REQUEST, useValue: mockRequest({ tenantId: TENANT }) },
      ],
    }).compile();

    useCase = module.get<CreateImovel>(CreateImovel);
  });

  it('K.5 — quarteirao normalizado → upsertMestreIfMissing chamado', async () => {
    await useCase.execute({ quarteirao: '  Q01  ', bairro: 'Centro' } as any);

    expect(quarteiraoWriteRepo.upsertMestreIfMissing).toHaveBeenCalledWith(
      TENANT,
      'Centro',
      'Q01',
    );
  });

  it('K.5 — quarteirao nulo → upsertMestreIfMissing NÃO chamado', async () => {
    await useCase.execute({ quarteirao: null } as any);

    expect(quarteiraoWriteRepo.upsertMestreIfMissing).not.toHaveBeenCalled();
  });

  it('K.5 — falha em upsertMestreIfMissing não quebra criação do imóvel', async () => {
    quarteiraoWriteRepo.upsertMestreIfMissing.mockRejectedValueOnce(new Error('DB error'));

    const result = await useCase.execute({ quarteirao: 'Q02' } as any);

    expect(result.imovel).toBeDefined();
  });
});
