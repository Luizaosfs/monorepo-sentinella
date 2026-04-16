import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { FocoRiscoWriteRepository } from '../../repositories/foco-risco-write.repository';
import { mockRequest } from '@test/utils/user-helpers';

import { CreateFocoRisco } from '../create-foco-risco';
import { FocoRiscoBuilder } from './builders/foco-risco.builder';

describe('CreateFocoRisco', () => {
  let useCase: CreateFocoRisco;
  const writeRepo = mock<FocoRiscoWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateFocoRisco,
        { provide: FocoRiscoWriteRepository, useValue: writeRepo },
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
});
