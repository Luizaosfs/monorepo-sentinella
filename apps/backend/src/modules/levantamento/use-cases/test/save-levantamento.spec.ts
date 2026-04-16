import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { LevantamentoException } from '../../errors/levantamento.exception';
import { LevantamentoReadRepository } from '../../repositories/levantamento-read.repository';
import { LevantamentoWriteRepository } from '../../repositories/levantamento-write.repository';
import { expectHttpException } from '@test/utils/expect-http-exception';

import { SaveLevantamento } from '../save-levantamento';
import { LevantamentoBuilder } from './builders/levantamento.builder';

describe('SaveLevantamento', () => {
  let useCase: SaveLevantamento;
  const readRepo = mock<LevantamentoReadRepository>();
  const writeRepo = mock<LevantamentoWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaveLevantamento,
        { provide: LevantamentoReadRepository, useValue: readRepo },
        { provide: LevantamentoWriteRepository, useValue: writeRepo },
      ],
    }).compile();

    useCase = module.get<SaveLevantamento>(SaveLevantamento);
  });

  it('deve atualizar campos parciais (planejamentoId, cicloId, titulo, statusProcessamento, etc.)', async () => {
    const lev = new LevantamentoBuilder()
      .withId('lev-1')
      .withTitulo('Antigo')
      .withStatusProcessamento('aguardando')
      .build();
    readRepo.findById.mockResolvedValue(lev);

    await useCase.execute('lev-1', {
      planejamentoId: '00000000-0000-4000-8000-000000000001',
      cicloId: '00000000-0000-4000-8000-000000000002',
      titulo: 'Novo título',
      statusProcessamento: 'processando',
      observacao: 'obs',
    });

    expect(writeRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        planejamentoId: '00000000-0000-4000-8000-000000000001',
        cicloId: '00000000-0000-4000-8000-000000000002',
        titulo: 'Novo título',
        statusProcessamento: 'processando',
        observacao: 'obs',
      }),
    );
  });

  it('NÃO deve alterar campos não enviados', async () => {
    const lev = new LevantamentoBuilder()
      .withId('lev-1')
      .withTitulo('Original')
      .withCicloId('00000000-0000-4000-8000-000000000099')
      .withPlanejamentoId('00000000-0000-4000-8000-000000000088')
      .withStatusProcessamento('aguardando')
      .build();
    readRepo.findById.mockResolvedValue(lev);

    await useCase.execute('lev-1', {
      statusProcessamento: 'concluido',
    });

    expect(writeRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        titulo: 'Original',
        cicloId: '00000000-0000-4000-8000-000000000099',
        planejamentoId: '00000000-0000-4000-8000-000000000088',
        statusProcessamento: 'concluido',
      }),
    );
  });

  it('deve rejeitar não encontrado', async () => {
    readRepo.findById.mockResolvedValue(null);

    await expectHttpException(
      () => useCase.execute('nao-existe', { titulo: 'x' }),
      LevantamentoException.notFound(),
    );
  });
});
