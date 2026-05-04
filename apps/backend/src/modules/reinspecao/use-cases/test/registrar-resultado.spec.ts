import { FocoRiscoReadRepository } from '@modules/foco-risco/repositories/foco-risco-read.repository';
import { FocoRiscoWriteRepository } from '@modules/foco-risco/repositories/foco-risco-write.repository';
import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { expectHttpException } from '@test/utils/expect-http-exception';
import { mockRequest } from '@test/utils/user-helpers';

import { FocoRiscoBuilder } from '../../../foco-risco/use-cases/test/builders/foco-risco.builder';
import { ReinspecaoException } from '../../errors/reinspecao.exception';
import { ReinspecaoReadRepository } from '../../repositories/reinspecao-read.repository';
import { ReinspecaoWriteRepository } from '../../repositories/reinspecao-write.repository';
import { RegistrarResultadoReinspecao } from '../registrar-resultado';
import { ReinspecaoBuilder } from './builders/reinspecao.builder';

describe('RegistrarResultadoReinspecao', () => {
  let useCase: RegistrarResultadoReinspecao;
  const readRepo = mock<ReinspecaoReadRepository>();
  const writeRepo = mock<ReinspecaoWriteRepository>();
  const focoRead = mock<FocoRiscoReadRepository>();
  const focoWrite = mock<FocoRiscoWriteRepository>();

  async function buildWithRequest(req: ReturnType<typeof mockRequest>) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegistrarResultadoReinspecao,
        { provide: ReinspecaoReadRepository, useValue: readRepo },
        { provide: ReinspecaoWriteRepository, useValue: writeRepo },
        { provide: FocoRiscoReadRepository, useValue: focoRead },
        { provide: FocoRiscoWriteRepository, useValue: focoWrite },
        { provide: REQUEST, useValue: req },
      ],
    }).compile();
    return module.get<RegistrarResultadoReinspecao>(RegistrarResultadoReinspecao);
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    useCase = await buildWithRequest(mockRequest());
  });

  it('deve registrar resultado: status realizada e dataRealizada preenchida', async () => {
    const r = new ReinspecaoBuilder().withStatus('pendente').withFocoRiscoId('foco-1').build();
    const foco = new FocoRiscoBuilder().withId('foco-1').withClienteId(r.clienteId).build();
    readRepo.findById.mockResolvedValue(r);
    writeRepo.save.mockResolvedValue();
    focoRead.findById.mockResolvedValue(foco);
    focoWrite.createHistorico.mockResolvedValue({
      clienteId: foco.clienteId,
      statusNovo: foco.status,
    });

    const dataRealizada = new Date('2024-09-10T10:00:00Z');
    const result = await useCase.execute(r.id!, {
      resultado: 'Sem foco',
      dataRealizada,
    });

    expect(result.reinspecao.status).toBe('realizada');
    expect(result.reinspecao.resultado).toBe('Sem foco');
    expect(result.reinspecao.dataRealizada).toEqual(dataRealizada);
    expect(focoWrite.createHistorico).toHaveBeenCalledWith(
      expect.objectContaining({ tipoEvento: 'reinspecao_realizada' }),
    );
  });

  it('deve rejeitar não encontrada', async () => {
    readRepo.findById.mockResolvedValue(null);

    await expectHttpException(
      () => useCase.execute('x', { resultado: 'ok' }),
      ReinspecaoException.notFound(),
    );
  });

  it('deve rejeitar status != pendente', async () => {
    const r = new ReinspecaoBuilder().withStatus('realizada').build();
    readRepo.findById.mockResolvedValue(r);

    await expectHttpException(
      () => useCase.execute(r.id!, { resultado: 'ok' }),
      ReinspecaoException.badRequest(),
    );
    expect(writeRepo.save).not.toHaveBeenCalled();
  });

  describe('ownership — agente só registra resultado de reinspeção atribuída a si', () => {
    beforeEach(() => {
      writeRepo.save.mockResolvedValue();
      focoWrite.createHistorico.mockResolvedValue({ clienteId: 'test-cliente-id', statusNovo: 'em_tratamento' });
    });

    it('agente responsável pode registrar resultado', async () => {
      const uc = await buildWithRequest(
        mockRequest({ user: { id: 'agente-uuid', email: 'agente@test.com', nome: 'Agente', clienteId: 'test-cliente-id', papeis: ['agente'] } }),
      );
      const r = new ReinspecaoBuilder()
        .withStatus('pendente')
        .withFocoRiscoId('foco-1')
        .withResponsavelId('agente-uuid')
        .build();
      const foco = new FocoRiscoBuilder().withId('foco-1').withClienteId(r.clienteId).build();
      readRepo.findById.mockResolvedValue(r);
      focoRead.findById.mockResolvedValue(foco);

      const result = await uc.execute(r.id!, { resultado: 'Sem larvas' });

      expect(result.reinspecao.status).toBe('realizada');
    });

    it('agente bloqueado se responsavelId !== user.id', async () => {
      const uc = await buildWithRequest(
        mockRequest({ user: { id: 'agente-uuid', email: 'agente@test.com', nome: 'Agente', clienteId: 'test-cliente-id', papeis: ['agente'] } }),
      );
      const r = new ReinspecaoBuilder()
        .withStatus('pendente')
        .withResponsavelId('outro-agente')
        .build();
      readRepo.findById.mockResolvedValue(r);

      await expectHttpException(
        () => uc.execute(r.id!, { resultado: 'ok' }),
        ReinspecaoException.forbiddenTenant(),
      );
      expect(writeRepo.save).not.toHaveBeenCalled();
    });

    it('agente pode registrar em reinspeção sem responsavelId', async () => {
      const uc = await buildWithRequest(
        mockRequest({ user: { id: 'agente-uuid', email: 'agente@test.com', nome: 'Agente', clienteId: 'test-cliente-id', papeis: ['agente'] } }),
      );
      const r = new ReinspecaoBuilder().withStatus('pendente').withFocoRiscoId('foco-1').build();
      const foco = new FocoRiscoBuilder().withId('foco-1').withClienteId(r.clienteId).build();
      readRepo.findById.mockResolvedValue(r);
      focoRead.findById.mockResolvedValue(foco);

      const result = await uc.execute(r.id!, { resultado: 'ok' });

      expect(result.reinspecao.status).toBe('realizada');
    });

    it('supervisor pode registrar resultado de reinspeção de outro agente', async () => {
      const uc = await buildWithRequest(
        mockRequest({ user: { id: 'supervisor-uuid', email: 'sup@test.com', nome: 'Supervisor', clienteId: 'test-cliente-id', papeis: ['supervisor'] } }),
      );
      const r = new ReinspecaoBuilder()
        .withStatus('pendente')
        .withFocoRiscoId('foco-1')
        .withResponsavelId('outro-agente')
        .build();
      const foco = new FocoRiscoBuilder().withId('foco-1').withClienteId(r.clienteId).build();
      readRepo.findById.mockResolvedValue(r);
      focoRead.findById.mockResolvedValue(foco);

      const result = await uc.execute(r.id!, { resultado: 'ok' });

      expect(result.reinspecao.status).toBe('realizada');
    });
  });
});
