import { FocoRiscoReadRepository } from '@modules/foco-risco/repositories/foco-risco-read.repository';
import { FocoRiscoWriteRepository } from '@modules/foco-risco/repositories/foco-risco-write.repository';
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

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegistrarResultadoReinspecao,
        { provide: ReinspecaoReadRepository, useValue: readRepo },
        { provide: ReinspecaoWriteRepository, useValue: writeRepo },
        { provide: FocoRiscoReadRepository, useValue: focoRead },
        { provide: FocoRiscoWriteRepository, useValue: focoWrite },
        { provide: 'REQUEST', useValue: mockRequest() },
      ],
    }).compile();

    useCase = module.get<RegistrarResultadoReinspecao>(RegistrarResultadoReinspecao);
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
});
