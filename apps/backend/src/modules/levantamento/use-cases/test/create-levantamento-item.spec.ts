import { ForbiddenException } from '@nestjs/common';
import { mock } from 'jest-mock-extended';

import { VerificarQuota } from '../../../billing/use-cases/verificar-quota';
import { LevantamentoException } from '../../errors/levantamento.exception';
import { LevantamentoReadRepository } from '../../repositories/levantamento-read.repository';
import { LevantamentoWriteRepository } from '../../repositories/levantamento-write.repository';
import { CriarFocoDeLevantamentoItem } from '@/modules/foco-risco/use-cases/auto-criacao/criar-foco-de-levantamento-item';
import { expectHttpException } from '@test/utils/expect-http-exception';

import { CreateLevantamentoItem } from '../create-levantamento-item';
import { LevantamentoBuilder } from './builders/levantamento.builder';

const mockReq: any = {};

describe('CreateLevantamentoItem', () => {
  let useCase: CreateLevantamentoItem;
  const readRepo = mock<LevantamentoReadRepository>();
  const writeRepo = mock<LevantamentoWriteRepository>();
  const criarFoco = { execute: jest.fn().mockResolvedValue({ criado: false }) };
  const mockVerificarQuota = { execute: jest.fn().mockResolvedValue({ ok: true, usado: 0, limite: null }) };

  beforeEach(() => {
    jest.clearAllMocks();
    mockVerificarQuota.execute.mockResolvedValue({ ok: true, usado: 0, limite: null });
    mockReq.user = { isPlatformAdmin: true };
    mockReq.tenantId = undefined;
    useCase = new CreateLevantamentoItem(readRepo, writeRepo, criarFoco as any, mockVerificarQuota as any, mockReq as any);
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

  it('quota ok → cria item normalmente', async () => {
    const lev = new LevantamentoBuilder().withId('lev-q').withClienteId('cli-q').build();
    readRepo.findById.mockResolvedValue(lev);
    writeRepo.createItem.mockResolvedValue({ id: 'item-q' } as any);

    await useCase.execute('lev-q', {});

    expect(mockVerificarQuota.execute).toHaveBeenCalledWith('cli-q', { metrica: 'itens_mes' });
    expect(writeRepo.createItem).toHaveBeenCalled();
  });

  it('quota excedida → throw ForbiddenException antes de criar item', async () => {
    readRepo.findById.mockResolvedValue(new LevantamentoBuilder().build());
    mockVerificarQuota.execute.mockResolvedValue({ ok: false, usado: 100, limite: 100, motivo: 'excedido' });

    await expect(useCase.execute('lev-1', {})).rejects.toThrow(ForbiddenException);

    expect(writeRepo.createItem).not.toHaveBeenCalled();
  });

  it('falha do hook não deve quebrar a criação do item', async () => {
    readRepo.findById.mockResolvedValue(new LevantamentoBuilder().build());
    writeRepo.createItem.mockResolvedValue({ id: 'item-err' } as any);
    criarFoco.execute.mockRejectedValueOnce(new Error('boom'));

    const r = await useCase.execute('lev-1', {});
    expect(r.item).toEqual({ id: 'item-err' });
  });

  it('tenant errado → 404 (DB filtra), item não criado', async () => {
    const lev = new LevantamentoBuilder().withId('lev-t').withClienteId('cli-OWNER').build();
    readRepo.findById.mockImplementation(async (_id, clienteId) =>
      clienteId === 'cli-OWNER' ? lev : null,
    );
    const wrongTenantReq = { user: { isPlatformAdmin: false }, tenantId: 'cli-ERRADO' };
    const uc = new CreateLevantamentoItem(readRepo, writeRepo, criarFoco as any, mockVerificarQuota as any, wrongTenantReq as any);

    await expect(uc.execute('lev-t', {})).rejects.toBeDefined();
    expect(writeRepo.createItem).not.toHaveBeenCalled();
  });
});
