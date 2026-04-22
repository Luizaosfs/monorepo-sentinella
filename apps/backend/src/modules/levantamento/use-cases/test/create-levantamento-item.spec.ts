import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { LevantamentoException } from '../../errors/levantamento.exception';
import { LevantamentoReadRepository } from '../../repositories/levantamento-read.repository';
import { LevantamentoWriteRepository } from '../../repositories/levantamento-write.repository';
import { CriarFocoDeLevantamentoItem } from '@/modules/foco-risco/use-cases/auto-criacao/criar-foco-de-levantamento-item';
import { expectHttpException } from '@test/utils/expect-http-exception';

import { CreateLevantamentoItem } from '../create-levantamento-item';
import { LevantamentoBuilder } from './builders/levantamento.builder';

describe('CreateLevantamentoItem', () => {
  let useCase: CreateLevantamentoItem;
  const readRepo = mock<LevantamentoReadRepository>();
  const writeRepo = mock<LevantamentoWriteRepository>();
  const criarFoco = { execute: jest.fn().mockResolvedValue({ criado: false }) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateLevantamentoItem,
        { provide: LevantamentoReadRepository, useValue: readRepo },
        { provide: LevantamentoWriteRepository, useValue: writeRepo },
        { provide: CriarFocoDeLevantamentoItem, useValue: criarFoco },
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

  it('deve invocar hook CriarFocoDeLevantamentoItem após criar item (best-effort)', async () => {
    const lev = new LevantamentoBuilder().withId('lev-1').build();
    readRepo.findById.mockResolvedValue(lev);
    writeRepo.createItem.mockResolvedValue({
      id: 'item-9',
      latitude: -23.5,
      longitude: -46.6,
      prioridade: 'P2',
      risco: 'alto',
      enderecoCurto: 'Rua X',
      payload: undefined,
      createdAt: new Date('2026-04-20'),
    } as any);

    await useCase.execute('lev-1', {});

    expect(criarFoco.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: 'item-9',
        levantamentoId: 'lev-1',
        latitude: -23.5,
        longitude: -46.6,
      }),
    );
  });

  it('falha do hook não deve quebrar a criação do item', async () => {
    readRepo.findById.mockResolvedValue(new LevantamentoBuilder().build());
    writeRepo.createItem.mockResolvedValue({ id: 'item-err' } as any);
    criarFoco.execute.mockRejectedValueOnce(new Error('boom'));

    const r = await useCase.execute('lev-1', {});
    expect(r.item).toEqual({ id: 'item-err' });
  });
});
