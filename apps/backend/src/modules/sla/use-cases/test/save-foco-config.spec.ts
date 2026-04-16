import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { SlaFocoConfig } from '../../entities/sla-config';
import { SlaWriteRepository } from '../../repositories/sla-write.repository';
import { mockRequest } from '@test/utils/user-helpers';

import { SaveFocoConfig } from '../save-foco-config';

describe('SaveFocoConfig', () => {
  let useCase: SaveFocoConfig;
  const writeRepo = mock<SlaWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaveFocoConfig,
        { provide: SlaWriteRepository, useValue: writeRepo },
        {
          provide: REQUEST,
          useValue: mockRequest({ tenantId: 'test-cliente-id' }),
        },
      ],
    }).compile();
    useCase = module.get<SaveFocoConfig>(SaveFocoConfig);
  });

  it('deve fazer upsert de foco configs com clienteId do tenant', async () => {
    const configs = [
      { fase: 'triagem' as const, prazoMinutos: 60, ativo: true },
      { fase: 'inspecao' as const, prazoMinutos: 120, ativo: false },
    ];
    const retorno: SlaFocoConfig[] = [];
    writeRepo.upsertFocoConfig.mockResolvedValue(retorno);

    const result = await useCase.execute({ configs });

    expect(writeRepo.upsertFocoConfig).toHaveBeenCalledWith('test-cliente-id', configs);
    expect(result.configs).toBe(retorno);
  });
});
