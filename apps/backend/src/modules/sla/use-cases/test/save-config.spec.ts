import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { SlaReadRepository } from '../../repositories/sla-read.repository';
import { SlaWriteRepository } from '../../repositories/sla-write.repository';
import { mockRequest } from '@test/utils/user-helpers';

import { SaveConfig } from '../save-config';
import { SlaConfigBuilder } from './builders/sla-config.builder';

describe('SaveConfig', () => {
  let useCase: SaveConfig;
  const readRepo = mock<SlaReadRepository>();
  const writeRepo = mock<SlaWriteRepository>();

  const requestProvider = () => ({
    ...mockRequest({ tenantId: 'test-cliente-id' }),
    userId: 'auditor-user-id',
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaveConfig,
        { provide: SlaReadRepository, useValue: readRepo },
        { provide: SlaWriteRepository, useValue: writeRepo },
        { provide: REQUEST, useValue: requestProvider() },
      ],
    }).compile();
    useCase = module.get<SaveConfig>(SaveConfig);
  });

  it("deve fazer upsert de config e criar audit com action='create' quando não existe config anterior", async () => {
    readRepo.findConfig.mockResolvedValue(null);
    const saved = new SlaConfigBuilder().build();
    writeRepo.upsertConfig.mockResolvedValue(saved);
    writeRepo.createConfigAudit.mockResolvedValue();

    const novoConfig = { prazoP1: 4, prazoP2: 12 };
    const result = await useCase.execute({ config: novoConfig });

    expect(writeRepo.upsertConfig).toHaveBeenCalledWith('test-cliente-id', novoConfig);
    expect(writeRepo.createConfigAudit).toHaveBeenCalledWith({
      clienteId: 'test-cliente-id',
      changedBy: 'auditor-user-id',
      action: 'create',
      configBefore: undefined,
      configAfter: novoConfig,
    });
    expect(result.config).toBe(saved);
  });

  it("deve fazer upsert de config e criar audit com action='update' quando já existe config", async () => {
    const anterior = new SlaConfigBuilder().withConfig({ prazoP1: 8 }).build();
    readRepo.findConfig.mockResolvedValue(anterior);
    const saved = new SlaConfigBuilder().withConfig({ prazoP1: 6 }).build();
    writeRepo.upsertConfig.mockResolvedValue(saved);
    writeRepo.createConfigAudit.mockResolvedValue();

    const novoConfig = { prazoP1: 6 };
    await useCase.execute({ config: novoConfig });

    expect(writeRepo.createConfigAudit).toHaveBeenCalledWith({
      clienteId: 'test-cliente-id',
      changedBy: 'auditor-user-id',
      action: 'update',
      configBefore: anterior.config,
      configAfter: novoConfig,
    });
  });

  it('deve passar changedBy do request', async () => {
    readRepo.findConfig.mockResolvedValue(null);
    writeRepo.upsertConfig.mockResolvedValue(new SlaConfigBuilder().build());
    writeRepo.createConfigAudit.mockResolvedValue();

    await useCase.execute({ config: { x: 1 } });

    expect(writeRepo.createConfigAudit).toHaveBeenCalledWith(
      expect.objectContaining({ changedBy: 'auditor-user-id' }),
    );
  });
});
