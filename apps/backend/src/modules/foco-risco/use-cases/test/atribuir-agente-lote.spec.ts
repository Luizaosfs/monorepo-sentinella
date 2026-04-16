import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { FocoRiscoReadRepository } from '../../repositories/foco-risco-read.repository';
import { FocoRiscoWriteRepository } from '../../repositories/foco-risco-write.repository';
import { mockRequest } from '@test/utils/user-helpers';

import { AtribuirAgenteLote } from '../atribuir-agente-lote';
import { FocoRiscoBuilder } from './builders/foco-risco.builder';

describe('AtribuirAgenteLote', () => {
  let useCase: AtribuirAgenteLote;
  const readRepo = mock<FocoRiscoReadRepository>();
  const writeRepo = mock<FocoRiscoWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AtribuirAgenteLote,
        { provide: FocoRiscoReadRepository, useValue: readRepo },
        { provide: FocoRiscoWriteRepository, useValue: writeRepo },
        { provide: REQUEST, useValue: mockRequest({ tenantId: 'cliente-uuid-1' }) },
      ],
    }).compile();

    useCase = module.get<AtribuirAgenteLote>(AtribuirAgenteLote);
  });

  it('deve atribuir agente a múltiplos focos com sucesso', async () => {
    const focos = [
      new FocoRiscoBuilder().withId('f1').build(),
      new FocoRiscoBuilder().withId('f2').build(),
    ];
    readRepo.findManyByIds.mockResolvedValue(focos);
    writeRepo.save.mockResolvedValue();
    writeRepo.createHistorico.mockResolvedValue({
      clienteId: 'cliente-uuid-1',
      statusNovo: 'suspeita',
    });

    const result = await useCase.execute({
      focoIds: ['f1', 'f2'],
      agenteId: 'agente-uuid-1',
    } as any);

    expect(result.total).toBe(2);
    expect(result.sucesso).toBe(2);
    expect(result.falhas).toHaveLength(0);
    expect(writeRepo.save).toHaveBeenCalledTimes(2);
  });

  it('deve registrar falha para foco não encontrado no lote', async () => {
    const foco = new FocoRiscoBuilder().withId('f1').build();
    readRepo.findManyByIds.mockResolvedValue([foco]);
    writeRepo.save.mockResolvedValue();
    writeRepo.createHistorico.mockResolvedValue({
      clienteId: 'cliente-uuid-1',
      statusNovo: 'suspeita',
    });

    const result = await useCase.execute({
      focoIds: ['f1', 'nao-existe'],
      agenteId: 'agente-uuid-1',
    } as any);

    expect(result.total).toBe(2);
    expect(result.sucesso).toBe(1);
    expect(result.falhas).toHaveLength(1);
    expect(result.falhas[0].focoId).toBe('nao-existe');
  });

  it('deve filtrar focos pelo clienteId do tenant', async () => {
    readRepo.findManyByIds.mockResolvedValue([]);

    await useCase.execute({ focoIds: ['f1'], agenteId: 'agente-uuid-1' } as any);

    expect(readRepo.findManyByIds).toHaveBeenCalledWith(['f1'], 'cliente-uuid-1');
  });
});
