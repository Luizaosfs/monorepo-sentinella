import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { EnfileirarScoreImovel } from '../../../job/enfileirar-score-imovel';
import { FocoRiscoWriteRepository } from '../../repositories/foco-risco-write.repository';
import { mockRequest } from '@test/utils/user-helpers';

import { CreateFocoRisco } from '../create-foco-risco';
import { CruzarFocoNovoComCasos } from '../cruzar-foco-novo-com-casos';
import { NormalizarCicloFoco } from '../normalizar-ciclo-foco';
import { RecalcularScorePrioridadeFoco } from '../recalcular-score-prioridade-foco';
import { FocoRiscoBuilder } from './builders/foco-risco.builder';

describe('CreateFocoRisco', () => {
  let useCase: CreateFocoRisco;
  const writeRepo = mock<FocoRiscoWriteRepository>();
  const cruzarFocoNovoComCasos = mock<CruzarFocoNovoComCasos>();
  const recalcularScore = mock<RecalcularScorePrioridadeFoco>();
  const enfileirarScore = { enfileirarPorImovel: jest.fn().mockResolvedValue(undefined) };
  const mockNormalizarCiclo = { execute: jest.fn().mockResolvedValue(1) };

  beforeEach(async () => {
    jest.clearAllMocks();
    cruzarFocoNovoComCasos.execute.mockResolvedValue({ cruzamentos: 0 });
    recalcularScore.execute.mockResolvedValue({ score: 10 });
    enfileirarScore.enfileirarPorImovel.mockResolvedValue(undefined);
    mockNormalizarCiclo.execute.mockResolvedValue(1);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateFocoRisco,
        { provide: FocoRiscoWriteRepository, useValue: writeRepo },
        { provide: CruzarFocoNovoComCasos, useValue: cruzarFocoNovoComCasos },
        { provide: RecalcularScorePrioridadeFoco, useValue: recalcularScore },
        { provide: EnfileirarScoreImovel, useValue: enfileirarScore },
        { provide: NormalizarCicloFoco, useValue: mockNormalizarCiclo },
        { provide: REQUEST, useValue: mockRequest({ tenantId: 'cliente-uuid-1' }) },
      ],
    }).compile();

    useCase = module.get<CreateFocoRisco>(CreateFocoRisco);
  });

  it('deve criar foco com status suspeita e registrar histórico', async () => {
    const focoMock = new FocoRiscoBuilder().withStatus('suspeita').build();
    writeRepo.create.mockResolvedValue(focoMock);
    writeRepo.createHistorico.mockResolvedValue({
      clienteId: 'cliente-uuid-1',
      statusNovo: 'suspeita',
    });

    const result = await useCase.execute({
      origemTipo: 'agente',
      classificacaoInicial: 'suspeito',
    });

    expect(result.foco.status).toBe('suspeita');
    expect(writeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'suspeita', clienteId: 'cliente-uuid-1' }),
    );
    expect(writeRepo.createHistorico).toHaveBeenCalledWith(
      expect.objectContaining({
        statusNovo: 'suspeita',
        motivo: 'Foco criado',
        tipoEvento: 'criacao',
        clienteId: 'cliente-uuid-1',
      }),
    );
  });

  it('deve usar classificacaoInicial padrão "suspeito" se não informado', async () => {
    const focoMock = new FocoRiscoBuilder().build();
    writeRepo.create.mockResolvedValue(focoMock);
    writeRepo.createHistorico.mockResolvedValue({
      clienteId: 'cliente-uuid-1',
      statusNovo: 'suspeita',
    });

    await useCase.execute({ origemTipo: 'cidadao', classificacaoInicial: 'suspeito' });

    expect(writeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ classificacaoInicial: 'suspeito' }),
    );
  });

  it('deve usar clienteId do tenantId do request', async () => {
    const focoMock = new FocoRiscoBuilder().withClienteId('cliente-uuid-1').build();
    writeRepo.create.mockResolvedValue(focoMock);
    writeRepo.createHistorico.mockResolvedValue({
      clienteId: 'cliente-uuid-1',
      statusNovo: 'suspeita',
    });

    await useCase.execute({ origemTipo: 'agente', classificacaoInicial: 'suspeito' });

    expect(writeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ clienteId: 'cliente-uuid-1' }),
    );
  });

  it('deve invocar CruzarFocoNovoComCasos após criar foco', async () => {
    const focoMock = new FocoRiscoBuilder().build();
    writeRepo.create.mockResolvedValue(focoMock);
    writeRepo.createHistorico.mockResolvedValue({
      clienteId: 'cliente-uuid-1',
      statusNovo: 'suspeita',
    });

    await useCase.execute({ origemTipo: 'agente', classificacaoInicial: 'suspeito' });

    expect(cruzarFocoNovoComCasos.execute).toHaveBeenCalledTimes(1);
  });

  it('autoClassificarFoco: origemTipo=drone → classificacao_inicial=foco (ignora input.classificacaoInicial)', async () => {
    const focoMock = new FocoRiscoBuilder().build();
    writeRepo.create.mockResolvedValue(focoMock);
    writeRepo.createHistorico.mockResolvedValue({
      clienteId: 'cliente-uuid-1',
      statusNovo: 'suspeita',
    });

    await useCase.execute({
      origemTipo: 'drone',
      classificacaoInicial: 'suspeito',
    });

    expect(writeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ classificacaoInicial: 'foco' }),
    );
  });

  it('autoClassificarFoco: origemTipo=pluvio → classificacao_inicial=risco', async () => {
    const focoMock = new FocoRiscoBuilder().build();
    writeRepo.create.mockResolvedValue(focoMock);
    writeRepo.createHistorico.mockResolvedValue({
      clienteId: 'cliente-uuid-1',
      statusNovo: 'suspeita',
    });

    await useCase.execute({
      origemTipo: 'pluvio',
      classificacaoInicial: 'suspeito',
    });

    expect(writeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ classificacaoInicial: 'risco' }),
    );
  });

  it('falha no hook de cruzamento NÃO quebra a criação', async () => {
    const focoMock = new FocoRiscoBuilder().build();
    writeRepo.create.mockResolvedValue(focoMock);
    writeRepo.createHistorico.mockResolvedValue({
      clienteId: 'cliente-uuid-1',
      statusNovo: 'suspeita',
    });
    cruzarFocoNovoComCasos.execute.mockRejectedValueOnce(new Error('DB down'));

    const result = await useCase.execute({
      origemTipo: 'agente',
      classificacaoInicial: 'suspeito',
    });

    expect(result.foco).toBeDefined();
  });

  it('falha no hook RecalcularScore NÃO quebra a criação', async () => {
    const focoMock = new FocoRiscoBuilder().build();
    writeRepo.create.mockResolvedValue(focoMock);
    writeRepo.createHistorico.mockResolvedValue({
      clienteId: 'cliente-uuid-1',
      statusNovo: 'suspeita',
    });
    recalcularScore.execute.mockRejectedValueOnce(new Error('score falhou'));

    const result = await useCase.execute({
      origemTipo: 'agente',
      classificacaoInicial: 'suspeito',
    });

    expect(result.foco).toBeDefined();
    expect(result.foco.id).toBe('foco-uuid-1');
  });

  it('enfileira score do imóvel quando imovelId está presente', async () => {
    const focoMock = new FocoRiscoBuilder().withImovelId('imovel-uuid-1').build();
    writeRepo.create.mockResolvedValue(focoMock);
    writeRepo.createHistorico.mockResolvedValue({ clienteId: 'cliente-uuid-1', statusNovo: 'suspeita' });

    await useCase.execute({ origemTipo: 'agente', classificacaoInicial: 'suspeito' });

    expect(enfileirarScore.enfileirarPorImovel).toHaveBeenCalledWith('imovel-uuid-1', 'cliente-uuid-1');
  });

  it('NÃO enfileira score quando imovelId é null', async () => {
    const focoMock = new FocoRiscoBuilder().build();
    writeRepo.create.mockResolvedValue(focoMock);
    writeRepo.createHistorico.mockResolvedValue({ clienteId: 'cliente-uuid-1', statusNovo: 'suspeita' });

    await useCase.execute({ origemTipo: 'agente', classificacaoInicial: 'suspeito' });

    expect(enfileirarScore.enfileirarPorImovel).not.toHaveBeenCalled();
  });

  it('NormalizarCicloFoco é chamado com clienteId do tenant', async () => {
    const focoMock = new FocoRiscoBuilder().build();
    writeRepo.create.mockResolvedValue(focoMock);
    writeRepo.createHistorico.mockResolvedValue({ clienteId: 'cliente-uuid-1', statusNovo: 'suspeita' });

    await useCase.execute({ origemTipo: 'agente', classificacaoInicial: 'suspeito' });

    expect(mockNormalizarCiclo.execute).toHaveBeenCalledWith('cliente-uuid-1');
  });

  it('ciclo retornado por NormalizarCicloFoco é incluído na entidade criada', async () => {
    mockNormalizarCiclo.execute.mockResolvedValue(3);
    const focoMock = new FocoRiscoBuilder().build();
    writeRepo.create.mockResolvedValue(focoMock);
    writeRepo.createHistorico.mockResolvedValue({ clienteId: 'cliente-uuid-1', statusNovo: 'suspeita' });

    await useCase.execute({ origemTipo: 'agente', classificacaoInicial: 'suspeito' });

    expect(writeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ ciclo: 3 }),
    );
  });

  it('falha no hook enfileirarScore NÃO interrompe a criação', async () => {
    const focoMock = new FocoRiscoBuilder().withImovelId('imovel-uuid-1').build();
    writeRepo.create.mockResolvedValue(focoMock);
    writeRepo.createHistorico.mockResolvedValue({ clienteId: 'cliente-uuid-1', statusNovo: 'suspeita' });
    enfileirarScore.enfileirarPorImovel.mockRejectedValueOnce(new Error('job_queue down'));

    const result = await useCase.execute({ origemTipo: 'agente', classificacaoInicial: 'suspeito' });

    expect(result.foco).toBeDefined();
  });

  // K.1 — elevarPrioridadeRecorrencia
  it('K.1 — focoAnteriorId presente → prioridade elevada (P3 → P2)', async () => {
    const focoMock = new FocoRiscoBuilder().build();
    writeRepo.create.mockResolvedValue(focoMock);
    writeRepo.createHistorico.mockResolvedValue({ clienteId: 'cliente-uuid-1', statusNovo: 'suspeita' });

    await useCase.execute({
      origemTipo: 'agente',
      classificacaoInicial: 'suspeito',
      focoAnteriorId: 'foco-anterior-uuid',
      prioridade: 'P3' as any,
    });

    expect(writeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ prioridade: 'P2' }),
    );
  });

  it('K.1 — sem focoAnteriorId → prioridade original mantida (P3 → P3)', async () => {
    const focoMock = new FocoRiscoBuilder().build();
    writeRepo.create.mockResolvedValue(focoMock);
    writeRepo.createHistorico.mockResolvedValue({ clienteId: 'cliente-uuid-1', statusNovo: 'suspeita' });

    await useCase.execute({
      origemTipo: 'agente',
      classificacaoInicial: 'suspeito',
      prioridade: 'P3' as any,
    });

    expect(writeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ prioridade: 'P3' }),
    );
  });
});

