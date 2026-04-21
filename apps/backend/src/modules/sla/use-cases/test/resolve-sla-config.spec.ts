import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { SlaConfig } from '../../entities/sla-config';
import { SlaReadRepository } from '../../repositories/sla-read.repository';
import { ResolveSlaConfig } from '../resolve-sla-config';

function makeConfig(clienteId: string, config: Record<string, unknown>): SlaConfig {
  return new SlaConfig({ clienteId, config: config as any }, { id: 'cfg-1' });
}

describe('ResolveSlaConfig', () => {
  let useCase: ResolveSlaConfig;
  const readRepo = mock<SlaReadRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResolveSlaConfig,
        { provide: SlaReadRepository, useValue: readRepo },
      ],
    }).compile();
    useCase = module.get(ResolveSlaConfig);
  });

  it('resolve por config regional quando disponível', async () => {
    readRepo.findConfigByRegiao.mockResolvedValue(
      makeConfig('c1', { P1: 2, P2: 8, P3: 20 }),
    );
    readRepo.findConfig.mockResolvedValue(null);

    const result = await useCase.execute({
      clienteId: 'c1',
      regiaoId: 'r1',
      prioridade: 'P2',
    });

    expect(result).toEqual({ slaHoras: 8, fromFallback: false, source: 'regiao' });
    expect(readRepo.findConfig).not.toHaveBeenCalled();
  });

  it('cai para config do cliente se regional ausente', async () => {
    readRepo.findConfigByRegiao.mockResolvedValue(null);
    readRepo.findConfig.mockResolvedValue(
      makeConfig('c1', { P3: 30 }),
    );

    const result = await useCase.execute({
      clienteId: 'c1',
      regiaoId: 'r1',
      prioridade: 'P3',
    });

    expect(result).toEqual({ slaHoras: 30, fromFallback: false, source: 'cliente' });
  });

  it('cai para fallback quando nenhuma config cobre a prioridade', async () => {
    readRepo.findConfigByRegiao.mockResolvedValue(null);
    readRepo.findConfig.mockResolvedValue(null);

    const result = await useCase.execute({
      clienteId: 'c1',
      regiaoId: null,
      prioridade: 'P1',
    });

    expect(result).toEqual({ slaHoras: 4, fromFallback: true, source: 'fallback' });
  });

  it('fallback para prioridade fora de P1..P5 usa P3 (24h)', async () => {
    readRepo.findConfigByRegiao.mockResolvedValue(null);
    readRepo.findConfig.mockResolvedValue(null);

    const result = await useCase.execute({
      clienteId: 'c1',
      prioridade: 'P99',
    });

    expect(result.slaHoras).toBe(24);
    expect(result.fromFallback).toBe(true);
  });

  it('aceita string numérica e rejeita negativo/zero/NaN', async () => {
    readRepo.findConfigByRegiao.mockResolvedValue(null);
    readRepo.findConfig.mockResolvedValue(
      makeConfig('c1', { P1: '6', P2: -1, P3: 0, P4: 'abc' }),
    );

    const p1 = await useCase.execute({ clienteId: 'c1', prioridade: 'P1' });
    expect(p1.slaHoras).toBe(6);
    expect(p1.source).toBe('cliente');

    // P2 negativo → fallback
    const p2 = await useCase.execute({ clienteId: 'c1', prioridade: 'P2' });
    expect(p2.slaHoras).toBe(12);
    expect(p2.fromFallback).toBe(true);

    // P3 zero → fallback
    const p3 = await useCase.execute({ clienteId: 'c1', prioridade: 'P3' });
    expect(p3.slaHoras).toBe(24);
    expect(p3.fromFallback).toBe(true);

    // P4 string não numérica → fallback
    const p4 = await useCase.execute({ clienteId: 'c1', prioridade: 'P4' });
    expect(p4.slaHoras).toBe(72);
    expect(p4.fromFallback).toBe(true);
  });

  it('não consulta config regional quando regiaoId ausente', async () => {
    readRepo.findConfig.mockResolvedValue(makeConfig('c1', { P3: 48 }));

    const result = await useCase.execute({
      clienteId: 'c1',
      prioridade: 'P3',
    });

    expect(readRepo.findConfigByRegiao).not.toHaveBeenCalled();
    expect(result.slaHoras).toBe(48);
  });
});
