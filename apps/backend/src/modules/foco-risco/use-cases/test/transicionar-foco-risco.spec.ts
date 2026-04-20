import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { FocoRiscoException } from '../../errors/foco-risco.exception';
import { FocoRiscoReadRepository } from '../../repositories/foco-risco-read.repository';
import { FocoRiscoWriteRepository } from '../../repositories/foco-risco-write.repository';
import { expectHttpException } from '@test/utils/expect-http-exception';
import { mockRequest } from '@test/utils/user-helpers';

import { TransicionarFocoRisco } from '../transicionar-foco-risco';
import { FocoRiscoBuilder } from './builders/foco-risco.builder';

describe('TransicionarFocoRisco', () => {
  let useCase: TransicionarFocoRisco;
  const readRepo = mock<FocoRiscoReadRepository>();
  const writeRepo = mock<FocoRiscoWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransicionarFocoRisco,
        { provide: FocoRiscoReadRepository, useValue: readRepo },
        { provide: FocoRiscoWriteRepository, useValue: writeRepo },
        { provide: REQUEST, useValue: mockRequest({ tenantId: 'cliente-uuid-1' }) },
      ],
    }).compile();

    useCase = module.get<TransicionarFocoRisco>(TransicionarFocoRisco);
  });

  it('deve transicionar suspeita → em_triagem', async () => {
    const foco = new FocoRiscoBuilder().withStatus('suspeita').build();
    readRepo.findById.mockResolvedValue(foco);
    writeRepo.save.mockResolvedValue();
    writeRepo.createHistorico.mockResolvedValue({
      clienteId: 'cliente-uuid-1',
      statusNovo: 'em_triagem',
    });

    const result = await useCase.execute(foco.id!, { statusPara: 'em_triagem' });

    expect(result.foco.status).toBe('em_triagem');
    expect(writeRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'em_triagem' }));
    expect(writeRepo.createHistorico).toHaveBeenCalledWith(
      expect.objectContaining({ statusAnterior: 'suspeita', statusNovo: 'em_triagem' }),
    );
  });

  it('deve transicionar em_tratamento → resolvido e preencher resolvidoEm', async () => {
    const foco = new FocoRiscoBuilder().withStatus('em_tratamento').build();
    readRepo.findById.mockResolvedValue(foco);
    writeRepo.save.mockResolvedValue();
    writeRepo.createHistorico.mockResolvedValue({
      clienteId: 'cliente-uuid-1',
      statusNovo: 'resolvido',
    });

    const result = await useCase.execute(foco.id!, {
      statusPara: 'resolvido',
      desfecho: 'Tratamento concluído',
    });

    expect(result.foco.status).toBe('resolvido');
    expect(result.foco.resolvidoEm).toBeInstanceOf(Date);
    expect(result.foco.desfecho).toBe('Tratamento concluído');
  });

  it('deve preencher confirmadoEm ao confirmar', async () => {
    const foco = new FocoRiscoBuilder().withStatus('em_inspecao').build();
    readRepo.findById.mockResolvedValue(foco);
    writeRepo.save.mockResolvedValue();
    writeRepo.createHistorico.mockResolvedValue({
      clienteId: 'cliente-uuid-1',
      statusNovo: 'confirmado',
    });

    const result = await useCase.execute(foco.id!, { statusPara: 'confirmado' });

    expect(result.foco.confirmadoEm).toBeInstanceOf(Date);
  });

  it('deve preencher resolvidoEm ao descartar', async () => {
    const foco = new FocoRiscoBuilder().withStatus('em_triagem').build();
    readRepo.findById.mockResolvedValue(foco);
    writeRepo.save.mockResolvedValue();
    writeRepo.createHistorico.mockResolvedValue({
      clienteId: 'cliente-uuid-1',
      statusNovo: 'descartado',
    });

    const result = await useCase.execute(foco.id!, { statusPara: 'descartado' });

    expect(result.foco.resolvidoEm).toBeInstanceOf(Date);
  });

  it('deve rejeitar aguarda_inspecao → em_inspecao (fluxo exclusivo de iniciar-inspecao)', async () => {
    const foco = new FocoRiscoBuilder().withStatus('aguarda_inspecao').build();
    readRepo.findById.mockResolvedValue(foco);

    await expectHttpException(
      () =>
        useCase.execute(foco.id!, {
          statusPara: 'em_inspecao' as never,
        }),
      FocoRiscoException.transicaoInvalida(),
    );
    expect(writeRepo.save).not.toHaveBeenCalled();
  });

  it('deve rejeitar transição inválida suspeita → confirmado', async () => {
    const foco = new FocoRiscoBuilder().withStatus('suspeita').build();
    readRepo.findById.mockResolvedValue(foco);

    await expectHttpException(
      () => useCase.execute(foco.id!, { statusPara: 'confirmado' }),
      FocoRiscoException.transicaoInvalida(),
    );
    expect(writeRepo.save).not.toHaveBeenCalled();
    expect(writeRepo.createHistorico).not.toHaveBeenCalled();
  });

  it('deve rejeitar foco não encontrado', async () => {
    readRepo.findById.mockResolvedValue(null);

    await expectHttpException(
      () => useCase.execute('nao-existe', { statusPara: 'em_triagem' }),
      FocoRiscoException.notFound(),
    );
  });

  it('deve gerar registro em historico com usuarioId do request', async () => {
    const foco = new FocoRiscoBuilder().withStatus('suspeita').build();
    readRepo.findById.mockResolvedValue(foco);
    writeRepo.save.mockResolvedValue();
    writeRepo.createHistorico.mockResolvedValue({
      clienteId: 'cliente-uuid-1',
      statusNovo: 'em_triagem',
    });

    await useCase.execute(foco.id!, { statusPara: 'em_triagem', motivo: 'triagem inicial' });

    expect(writeRepo.createHistorico).toHaveBeenCalledWith(
      expect.objectContaining({
        focoRiscoId: foco.id,
        clienteId: foco.clienteId,
        statusAnterior: 'suspeita',
        statusNovo: 'em_triagem',
        alteradoPor: 'test-user-id',
        motivo: 'triagem inicial',
        tipoEvento: 'mudanca_status',
      }),
    );
  });
});
