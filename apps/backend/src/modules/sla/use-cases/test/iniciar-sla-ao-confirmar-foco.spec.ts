import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { FocoRiscoBuilder } from '../../../foco-risco/use-cases/test/builders/foco-risco.builder';
import { SlaReadRepository } from '../../repositories/sla-read.repository';
import { SlaWriteRepository } from '../../repositories/sla-write.repository';
import { IniciarSlaAoConfirmarFoco } from '../iniciar-sla-ao-confirmar-foco';
import { ResolveSlaConfig } from '../resolve-sla-config';
import { SlaOperacionalBuilder } from './builders/sla-operacional.builder';

describe('IniciarSlaAoConfirmarFoco', () => {
  let useCase: IniciarSlaAoConfirmarFoco;
  const readRepo = mock<SlaReadRepository>();
  const writeRepo = mock<SlaWriteRepository>();
  const resolveSlaConfig = mock<ResolveSlaConfig>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IniciarSlaAoConfirmarFoco,
        { provide: SlaReadRepository, useValue: readRepo },
        { provide: SlaWriteRepository, useValue: writeRepo },
        { provide: ResolveSlaConfig, useValue: resolveSlaConfig },
      ],
    }).compile();
    useCase = module.get(IniciarSlaAoConfirmarFoco);
  });

  it('é idempotente: se SLA já existe para o foco, retorna ja_existente sem criar', async () => {
    const foco = new FocoRiscoBuilder().withStatus('confirmado').build();
    const existente = new SlaOperacionalBuilder().withId('sla-existente').build();
    readRepo.findByFocoRiscoId.mockResolvedValue(existente);

    const result = await useCase.execute(foco);

    expect(result).toEqual({ acao: 'ja_existente', slaId: 'sla-existente' });
    expect(writeRepo.createFromFoco).not.toHaveBeenCalled();
    expect(writeRepo.vincularAFoco).not.toHaveBeenCalled();
    expect(resolveSlaConfig.execute).not.toHaveBeenCalled();
  });

  it('vincula SLA órfão (origem bulk) antes de tentar criar', async () => {
    const foco = new FocoRiscoBuilder()
      .withStatus('confirmado')
      .withOrigemLevantamentoItemId('li-1')
      .build();
    readRepo.findByFocoRiscoId
      .mockResolvedValueOnce(null) // passo 1: idempotência → nada
      .mockResolvedValueOnce(new SlaOperacionalBuilder().withId('sla-orfao').build()); // passo 2: após vínculo
    writeRepo.vincularAFoco.mockResolvedValue(1);

    const result = await useCase.execute(foco);

    expect(writeRepo.vincularAFoco).toHaveBeenCalledWith(
      foco.id,
      'li-1',
      undefined,
    );
    expect(result).toEqual({ acao: 'vinculado', slaId: 'sla-orfao', vinculados: 1 });
    expect(writeRepo.createFromFoco).not.toHaveBeenCalled();
    expect(resolveSlaConfig.execute).not.toHaveBeenCalled();
  });

  it('cria SLA novo quando não há órfão: usa prioridade do foco e resolve config', async () => {
    const foco = new FocoRiscoBuilder()
      .withStatus('confirmado')
      .withPrioridade('P2')
      .withRegiaoId('regiao-42')
      .build();
    readRepo.findByFocoRiscoId.mockResolvedValue(null);
    resolveSlaConfig.execute.mockResolvedValue({
      slaHoras: 8,
      fromFallback: false,
      source: 'regiao',
    });
    writeRepo.createFromFoco.mockResolvedValue({ id: 'sla-novo', conflicted: false });

    const result = await useCase.execute(foco);

    expect(resolveSlaConfig.execute).toHaveBeenCalledWith({
      clienteId: foco.clienteId,
      regiaoId: 'regiao-42',
      prioridade: 'P2',
    });
    expect(writeRepo.createFromFoco).toHaveBeenCalledWith(
      expect.objectContaining({
        clienteId: foco.clienteId,
        focoRiscoId: foco.id,
        prioridade: 'P2',
        slaHoras: 8,
      }),
      undefined,
    );
    expect(result).toEqual({ acao: 'criado', slaId: 'sla-novo', fromFallback: false });
  });

  it('default: prioridade ausente → P3', async () => {
    const foco = new FocoRiscoBuilder().withStatus('confirmado').build();
    // FocoRiscoBuilder default é P3; vamos forçar undefined
    (foco as any).props = { ...(foco as any).props, prioridade: undefined };
    readRepo.findByFocoRiscoId.mockResolvedValue(null);
    resolveSlaConfig.execute.mockResolvedValue({
      slaHoras: 24,
      fromFallback: true,
      source: 'fallback',
    });
    writeRepo.createFromFoco.mockResolvedValue({ id: 'sla-p3', conflicted: false });

    const result = await useCase.execute(foco);

    expect(resolveSlaConfig.execute).toHaveBeenCalledWith(
      expect.objectContaining({ prioridade: 'P3' }),
    );
    expect(result.acao).toBe('criado');
    expect(result.fromFallback).toBe(true);
  });

  it('race condition: createFromFoco retorna conflicted → ja_existente', async () => {
    const foco = new FocoRiscoBuilder().withStatus('confirmado').build();
    readRepo.findByFocoRiscoId
      .mockResolvedValueOnce(null) // idempotência inicial
      .mockResolvedValueOnce(new SlaOperacionalBuilder().withId('sla-race').build()); // pós-race
    resolveSlaConfig.execute.mockResolvedValue({
      slaHoras: 24,
      fromFallback: true,
      source: 'fallback',
    });
    writeRepo.createFromFoco.mockResolvedValue({ id: '', conflicted: true });

    const result = await useCase.execute(foco);

    expect(result).toEqual({ acao: 'ja_existente', slaId: 'sla-race' });
  });

  it('calcula prazoFinal = inicio + slaHoras horas', async () => {
    const foco = new FocoRiscoBuilder().withStatus('confirmado').build();
    readRepo.findByFocoRiscoId.mockResolvedValue(null);
    resolveSlaConfig.execute.mockResolvedValue({
      slaHoras: 10,
      fromFallback: false,
      source: 'cliente',
    });
    writeRepo.createFromFoco.mockResolvedValue({ id: 'sla-x', conflicted: false });

    await useCase.execute(foco);

    const call = writeRepo.createFromFoco.mock.calls[0][0];
    const diffMs = call.prazoFinal.getTime() - call.inicio.getTime();
    expect(diffMs).toBe(10 * 60 * 60 * 1000);
  });
});
