import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { FocoRiscoException } from '../../errors/foco-risco.exception';
import { FocoRiscoReadRepository } from '../../repositories/foco-risco-read.repository';
import { FocoRiscoWriteRepository } from '../../repositories/foco-risco-write.repository';
import { expectHttpException } from '@test/utils/expect-http-exception';
import { mockRequest } from '@test/utils/user-helpers';

import { AtribuirAgente } from '../atribuir-agente';
import { FocoRiscoBuilder } from './builders/foco-risco.builder';

describe('AtribuirAgente', () => {
  let useCase: AtribuirAgente;
  const readRepo = mock<FocoRiscoReadRepository>();
  const writeRepo = mock<FocoRiscoWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AtribuirAgente,
        { provide: FocoRiscoReadRepository, useValue: readRepo },
        { provide: FocoRiscoWriteRepository, useValue: writeRepo },
        { provide: REQUEST, useValue: mockRequest() },
      ],
    }).compile();

    useCase = module.get<AtribuirAgente>(AtribuirAgente);
  });

  it('deve vincular agente ao foco e registrar histórico', async () => {
    const foco = new FocoRiscoBuilder().withStatus('aguarda_inspecao').build();
    readRepo.findById.mockResolvedValue(foco);
    writeRepo.save.mockResolvedValue();
    writeRepo.createHistorico.mockResolvedValue({
      clienteId: foco.clienteId,
      statusNovo: foco.status,
    });

    const result = await useCase.execute(foco.id!, { agenteId: 'agente-uuid-1' });

    expect(result.foco.responsavelId).toBe('agente-uuid-1');
    expect(writeRepo.save).toHaveBeenCalledTimes(1);
    expect(writeRepo.createHistorico).toHaveBeenCalledWith(
      expect.objectContaining({ focoRiscoId: foco.id, clienteId: foco.clienteId }),
    );
  });

  it('deve usar motivo personalizado no histórico', async () => {
    const foco = new FocoRiscoBuilder().build();
    readRepo.findById.mockResolvedValue(foco);
    writeRepo.save.mockResolvedValue();
    writeRepo.createHistorico.mockResolvedValue({
      clienteId: foco.clienteId,
      statusNovo: foco.status,
    });

    await useCase.execute(foco.id!, { agenteId: 'agente-uuid-1', motivo: 'Redistribuição' });

    expect(writeRepo.createHistorico).toHaveBeenCalledWith(
      expect.objectContaining({ motivo: 'Redistribuição' }),
    );
  });

  it('deve rejeitar foco não encontrado', async () => {
    readRepo.findById.mockResolvedValue(null);

    await expectHttpException(
      () => useCase.execute('nao-existe', { agenteId: 'agente-uuid-1' }),
      FocoRiscoException.notFound(),
    );
  });
});
