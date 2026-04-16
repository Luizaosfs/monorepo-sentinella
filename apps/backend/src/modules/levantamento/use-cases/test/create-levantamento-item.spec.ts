import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { LevantamentoException } from '../../errors/levantamento.exception';
import { LevantamentoReadRepository } from '../../repositories/levantamento-read.repository';
import { LevantamentoWriteRepository } from '../../repositories/levantamento-write.repository';
import { expectHttpException } from '@test/utils/expect-http-exception';

import { CreateLevantamentoItem } from '../create-levantamento-item';
import { LevantamentoBuilder } from './builders/levantamento.builder';

describe('CreateLevantamentoItem', () => {
  let useCase: CreateLevantamentoItem;
  const readRepo = mock<LevantamentoReadRepository>();
  const writeRepo = mock<LevantamentoWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateLevantamentoItem,
        { provide: LevantamentoReadRepository, useValue: readRepo },
        { provide: LevantamentoWriteRepository, useValue: writeRepo },
      ],
    }).compile();

    useCase = module.get<CreateLevantamentoItem>(CreateLevantamentoItem);
  });

  it('deve criar item vinculado ao levantamento', async () => {
    const lev = new LevantamentoBuilder().withId('lev-1').build();
    readRepo.findById.mockResolvedValue(lev);
    const item = { id: 'item-1', levantamentoId: 'lev-1' };
    writeRepo.createItem.mockResolvedValue(item as any);

    const result = await useCase.execute('lev-1', {});

    expect(result.item).toBe(item);
    expect(writeRepo.createItem).toHaveBeenCalledWith(
      expect.objectContaining({ levantamentoId: 'lev-1' }),
    );
  });

  it('deve propagar latitude, longitude, item, risco, acao, scoreFinal, prioridade, slaHoras, etc.', async () => {
    readRepo.findById.mockResolvedValue(new LevantamentoBuilder().build());
    const dataHora = new Date('2026-01-01T12:00:00Z');
    writeRepo.createItem.mockResolvedValue({ id: 'i1' } as any);

    await useCase.execute('lev-1', {
      latitude: -23.5,
      longitude: -46.6,
      item: 'tanque',
      risco: 'alto',
      acao: 'tratar',
      scoreFinal: 80,
      prioridade: 'P1',
      slaHoras: 24,
      enderecoCurto: 'Rua A',
      enderecoCompleto: 'Rua A, 1',
      imageUrl: 'https://x/img',
      maps: 'https://maps',
      waze: 'https://waze',
      dataHora,
      peso: 1,
      payload: { a: 1 },
      imagePublicId: 'pub-id',
    });

    expect(writeRepo.createItem).toHaveBeenCalledWith({
      levantamentoId: 'lev-1',
      latitude: -23.5,
      longitude: -46.6,
      item: 'tanque',
      risco: 'alto',
      acao: 'tratar',
      scoreFinal: 80,
      prioridade: 'P1',
      slaHoras: 24,
      enderecoCurto: 'Rua A',
      enderecoCompleto: 'Rua A, 1',
      imageUrl: 'https://x/img',
      maps: 'https://maps',
      waze: 'https://waze',
      dataHora,
      peso: 1,
      payload: { a: 1 },
      imagePublicId: 'pub-id',
    });
  });

  it('deve rejeitar se levantamento não encontrado', async () => {
    readRepo.findById.mockResolvedValue(null);

    await expectHttpException(
      () => useCase.execute('nao-existe', {}),
      LevantamentoException.notFound(),
    );
  });
});
