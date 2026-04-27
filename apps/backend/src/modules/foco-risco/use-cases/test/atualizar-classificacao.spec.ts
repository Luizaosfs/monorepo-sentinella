import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { FocoRiscoException } from '../../errors/foco-risco.exception';
import { FocoRiscoReadRepository } from '../../repositories/foco-risco-read.repository';
import { FocoRiscoWriteRepository } from '../../repositories/foco-risco-write.repository';
import { expectHttpException } from '@test/utils/expect-http-exception';

import { AtualizarClassificacao } from '../atualizar-classificacao';
import { FocoRiscoBuilder } from './builders/foco-risco.builder';

describe('AtualizarClassificacao', () => {
  let useCase: AtualizarClassificacao;
  const readRepo = mock<FocoRiscoReadRepository>();
  const writeRepo = mock<FocoRiscoWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AtualizarClassificacao,
        { provide: FocoRiscoReadRepository, useValue: readRepo },
        { provide: FocoRiscoWriteRepository, useValue: writeRepo },
      ],
    }).compile();

    useCase = module.get<AtualizarClassificacao>(AtualizarClassificacao);
  });

  it('deve atualizar classificação do foco', async () => {
    const foco = new FocoRiscoBuilder().withClassificacaoInicial('suspeito').build();
    readRepo.findById.mockResolvedValue(foco);
    writeRepo.save.mockResolvedValue();

    const result = await useCase.execute(foco.id!, { focoId: foco.id!, classificacao: 'foco' }, 'cliente-test-uuid');

    expect(result.foco.classificacaoInicial).toBe('foco');
    expect(writeRepo.save).toHaveBeenCalledTimes(1);
  });

  it('deve rejeitar foco não encontrado', async () => {
    readRepo.findById.mockResolvedValue(null);

    await expectHttpException(
      () => useCase.execute('nao-existe', { focoId: 'nao-existe', classificacao: 'foco' }, 'cliente-test-uuid'),
      FocoRiscoException.notFound(),
    );
  });
});
