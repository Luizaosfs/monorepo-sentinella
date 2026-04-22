import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { FocoRiscoWriteRepository } from '../../repositories/foco-risco-write.repository';
import { mockRequest } from '@test/utils/user-helpers';

import { CreateFocoRisco } from '../create-foco-risco';
import { CruzarFocoNovoComCasos } from '../cruzar-foco-novo-com-casos';
import { FocoRiscoBuilder } from './builders/foco-risco.builder';

describe('CreateFocoRisco', () => {
  let useCase: CreateFocoRisco;
  const writeRepo = mock<FocoRiscoWriteRepository>();
  const cruzarFocoNovoComCasos = mock<CruzarFocoNovoComCasos>();

  beforeEach(async () => {
    jest.clearAllMocks();
    cruzarFocoNovoComCasos.execute.mockResolvedValue({ cruzamentos: 0 });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateFocoRisco,
        { provide: FocoRiscoWriteRepository, useValue: writeRepo },
        { provide: CruzarFocoNovoComCasos, useValue: cruzarFocoNovoComCasos },
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
});
