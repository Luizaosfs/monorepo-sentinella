import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { FocoRiscoBuilder } from '../../../foco-risco/use-cases/test/builders/foco-risco.builder';
import { ReinspecaoReadRepository } from '../../repositories/reinspecao-read.repository';
import { ReinspecaoWriteRepository } from '../../repositories/reinspecao-write.repository';
import { CriarReinspecaoPosTratamento } from '../criar-reinspecao-pos-tratamento';
import { ReinspecaoBuilder } from './builders/reinspecao.builder';

describe('CriarReinspecaoPosTratamento', () => {
  let useCase: CriarReinspecaoPosTratamento;
  const readRepo = mock<ReinspecaoReadRepository>();
  const writeRepo = mock<ReinspecaoWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CriarReinspecaoPosTratamento,
        { provide: ReinspecaoReadRepository, useValue: readRepo },
        { provide: ReinspecaoWriteRepository, useValue: writeRepo },
      ],
    }).compile();
    useCase = module.get(CriarReinspecaoPosTratamento);
  });

  it('cria reinspeção pendente de tipo eficacia_pos_tratamento com prazo +7 dias', async () => {
    const foco = new FocoRiscoBuilder().withStatus('em_tratamento').build();
    readRepo.findPendenteByFocoETipo.mockResolvedValue(null);
    const created = new ReinspecaoBuilder()
      .withId('reinsp-novo')
      .withFocoRiscoId(foco.id!)
      .withTipo('eficacia_pos_tratamento')
      .withOrigem('automatico')
      .build();
    writeRepo.createWithTx.mockResolvedValue(created);

    const antes = Date.now();
    const result = await useCase.execute(foco);
    const depois = Date.now();

    expect(result.acao).toBe('criada');
    expect(result.reinspecaoId).toBe('reinsp-novo');
    expect(writeRepo.createWithTx).toHaveBeenCalled();

    const entity = writeRepo.createWithTx.mock.calls[0][0];
    expect(entity.clienteId).toBe(foco.clienteId);
    expect(entity.focoRiscoId).toBe(foco.id);
    expect(entity.status).toBe('pendente');
    expect(entity.tipo).toBe('eficacia_pos_tratamento');
    expect(entity.origem).toBe('automatico');

    // Janela ≈ +7 dias (tolerância para slack da execução do teste)
    const sete = 7 * 24 * 60 * 60 * 1000;
    const diff = entity.dataPrevista.getTime() - antes;
    expect(diff).toBeGreaterThanOrEqual(sete - 5000);
    expect(entity.dataPrevista.getTime() - depois).toBeLessThanOrEqual(sete + 5000);
  });

  it('é idempotente: retorna ja_existente quando já há reinspeção pendente do mesmo tipo', async () => {
    const foco = new FocoRiscoBuilder().withStatus('em_tratamento').build();
    const existente = new ReinspecaoBuilder()
      .withId('reinsp-existente')
      .withTipo('eficacia_pos_tratamento')
      .build();
    readRepo.findPendenteByFocoETipo.mockResolvedValue(existente);

    const result = await useCase.execute(foco);

    expect(result).toEqual({
      acao: 'ja_existente',
      reinspecaoId: 'reinsp-existente',
    });
    expect(writeRepo.createWithTx).not.toHaveBeenCalled();
  });

  it('repassa o tx ao repositório de leitura e escrita', async () => {
    const foco = new FocoRiscoBuilder().withStatus('em_tratamento').build();
    readRepo.findPendenteByFocoETipo.mockResolvedValue(null);
    writeRepo.createWithTx.mockResolvedValue(
      new ReinspecaoBuilder().withId('reinsp-tx').build(),
    );
    const tx = { __mock_tx__: true };

    await useCase.execute(foco, tx);

    expect(readRepo.findPendenteByFocoETipo).toHaveBeenCalledWith(
      foco.id,
      'eficacia_pos_tratamento',
      tx,
    );
    expect(writeRepo.createWithTx).toHaveBeenCalledWith(
      expect.anything(),
      tx,
    );
  });
});
