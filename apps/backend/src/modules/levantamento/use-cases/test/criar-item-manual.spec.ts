import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { ForbiddenException } from '@nestjs/common';

import { VerificarQuota } from '../../../billing/use-cases/verificar-quota';
import { LevantamentoException } from '../../errors/levantamento.exception';
import { LevantamentoReadRepository } from '../../repositories/levantamento-read.repository';
import { LevantamentoWriteRepository } from '../../repositories/levantamento-write.repository';
import { CriarFocoDeLevantamentoItem } from '@/modules/foco-risco/use-cases/auto-criacao/criar-foco-de-levantamento-item';
import { expectHttpException } from '@test/utils/expect-http-exception';
import { mockRequest } from '@test/utils/user-helpers';

import { CriarItemManual } from '../criar-item-manual';
import { LevantamentoBuilder } from './builders/levantamento.builder';

describe('CriarItemManual', () => {
  let useCase: CriarItemManual;
  const readRepo = mock<LevantamentoReadRepository>();
  const writeRepo = mock<LevantamentoWriteRepository>();
  const criarFoco = { execute: jest.fn().mockResolvedValue({ criado: false }) };
  const mockVerificarQuota = { execute: jest.fn().mockResolvedValue({ ok: true, usado: 0, limite: null }) };

  const planejamentoAtivo = {
    id: 'plan-1',
    ativo: true,
    clienteId: 'c1',
    tipoEntrada: 'drone',
  };

  const dataVoo = new Date('2026-04-01');

  const baseInput = {
    planejamentoId: 'plan-1',
    dataVoo,
    latitude: 1,
    longitude: 2,
    item: 'x',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockVerificarQuota.execute.mockResolvedValue({ ok: true, usado: 0, limite: null });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CriarItemManual,
        { provide: LevantamentoReadRepository, useValue: readRepo },
        { provide: LevantamentoWriteRepository, useValue: writeRepo },
        { provide: CriarFocoDeLevantamentoItem, useValue: criarFoco },
        { provide: 'REQUEST', useValue: mockRequest({ tenantId: 'test-cliente-id' }) },
        { provide: VerificarQuota, useValue: mockVerificarQuota },
      ],
    }).compile();

    useCase = module.get<CriarItemManual>(CriarItemManual);
  });

  it('deve validar planejamento existente e ativo', async () => {
    readRepo.findPlanejamento.mockResolvedValue(planejamentoAtivo);
    readRepo.findByPlanejamentoDataTipo.mockResolvedValue(null);
    readRepo.findSlaConfig.mockResolvedValue(null);
    writeRepo.createLevantamentoManual.mockResolvedValue({ id: 'new-lev' });
    writeRepo.criarItemManual.mockResolvedValue({
      id: 'item-1',
      levantamentoId: 'new-lev',
      createdAt: new Date(),
    });

    await useCase.execute(baseInput);

    expect(readRepo.findPlanejamento).toHaveBeenCalledWith('plan-1');
  });

  it('deve rejeitar planejamento não encontrado', async () => {
    readRepo.findPlanejamento.mockResolvedValue(null);

    await expectHttpException(
      () => useCase.execute(baseInput),
      LevantamentoException.planejamentoNotFound(),
    );
  });

  it('deve rejeitar planejamento inativo', async () => {
    readRepo.findPlanejamento.mockResolvedValue({
      id: 'plan-1',
      ativo: false,
      clienteId: 'c1',
      tipoEntrada: 'manual',
    });

    await expectHttpException(
      () => useCase.execute(baseInput),
      LevantamentoException.planejamentoInativo(),
    );
  });

  it('deve buscar levantamento existente para (cliente, planejamento, dataVoo, tipoEntrada)', async () => {
    readRepo.findPlanejamento.mockResolvedValue(planejamentoAtivo);
    const existing = new LevantamentoBuilder().withId('lev-existing').build();
    readRepo.findByPlanejamentoDataTipo.mockResolvedValue(existing);
    readRepo.findSlaConfig.mockResolvedValue(null);
    writeRepo.criarItemManual.mockResolvedValue({
      id: 'item-1',
      levantamentoId: 'lev-existing',
      createdAt: new Date(),
    });

    const result = await useCase.execute(baseInput);

    expect(writeRepo.createLevantamentoManual).not.toHaveBeenCalled();
    expect(readRepo.findByPlanejamentoDataTipo).toHaveBeenCalledWith(
      'test-cliente-id',
      'plan-1',
      dataVoo,
      'drone',
    );
    expect(result.levantamentoId).toBe('lev-existing');
    expect(result.levantamentoCriado).toBe(false);
  });

  it('deve criar levantamento quando não existir para (cliente, planejamento, dataVoo, tipoEntrada)', async () => {
    readRepo.findPlanejamento.mockResolvedValue(planejamentoAtivo);
    readRepo.findByPlanejamentoDataTipo.mockResolvedValue(null);
    readRepo.findSlaConfig.mockResolvedValue(null);
    writeRepo.createLevantamentoManual.mockResolvedValue({ id: 'new-lev' });
    writeRepo.criarItemManual.mockResolvedValue({
      id: 'item-1',
      levantamentoId: 'new-lev',
      createdAt: new Date(),
    });

    const result = await useCase.execute(baseInput);

    expect(writeRepo.createLevantamentoManual).toHaveBeenCalledWith({
      clienteId: 'test-cliente-id',
      usuarioId: 'test-user-id',
      planejamentoId: 'plan-1',
      tipoEntrada: 'drone',
      dataVoo,
    });
    expect(result.levantamentoCriado).toBe(true);
    expect(result.levantamentoId).toBe('new-lev');
  });

  it("deve usar tipoEntrada do planejamento com fallback 'manual'", async () => {
    readRepo.findPlanejamento.mockResolvedValue({
      id: 'plan-1',
      ativo: true,
      clienteId: 'c1',
      tipoEntrada: null,
    });
    readRepo.findByPlanejamentoDataTipo.mockResolvedValue(null);
    readRepo.findSlaConfig.mockResolvedValue(null);
    writeRepo.createLevantamentoManual.mockResolvedValue({ id: 'nl' });
    writeRepo.criarItemManual.mockResolvedValue({
      id: 'i1',
      levantamentoId: 'nl',
      createdAt: new Date(),
    });

    await useCase.execute(baseInput);

    expect(writeRepo.createLevantamentoManual).toHaveBeenCalledWith(
      expect.objectContaining({ tipoEntrada: 'manual' }),
    );
    expect(readRepo.findByPlanejamentoDataTipo).toHaveBeenCalledWith(
      'test-cliente-id',
      'plan-1',
      dataVoo,
      'manual',
    );
  });

  it('deve chamar writeRepository.criarItemManual com os dados corretos', async () => {
    readRepo.findPlanejamento.mockResolvedValue(planejamentoAtivo);
    readRepo.findByPlanejamentoDataTipo.mockResolvedValue(
      new LevantamentoBuilder().withId('lev-x').build(),
    );
    readRepo.findSlaConfig.mockResolvedValue(null);
    const dh = new Date('2026-04-02T10:00:00Z');
    writeRepo.criarItemManual.mockResolvedValue({
      id: 'item-1',
      levantamentoId: 'lev-x',
      createdAt: new Date(),
    });

    await useCase.execute({
      ...baseInput,
      risco: 'médio',
      acao: 'visitar',
      scoreFinal: 10,
      prioridade: 'P2',
      slaHoras: 48,
      enderecoCurto: 'ec',
      enderecoCompleto: 'ecc',
      imageUrl: 'u',
      maps: 'm',
      waze: 'w',
      dataHora: dh,
      peso: 3,
      payload: { k: 'v' },
      imagePublicId: 'pid',
    });

    expect(writeRepo.criarItemManual).toHaveBeenCalledWith({
      levantamentoId: 'lev-x',
      clienteId: 'test-cliente-id',
      latitude: 1,
      longitude: 2,
      item: 'x',
      risco: 'médio',
      acao: 'visitar',
      scoreFinal: 10,
      prioridade: 'P2',
      slaHoras: 48,
      enderecoCurto: 'ec',
      enderecoCompleto: 'ecc',
      imageUrl: 'u',
      maps: 'm',
      waze: 'w',
      dataHora: dh,
      peso: 3,
      payload: { k: 'v' },
      imagePublicId: 'pid',
    });
  });

  it('deve incrementar totalItens do levantamento', async () => {
    readRepo.findPlanejamento.mockResolvedValue(planejamentoAtivo);
    readRepo.findByPlanejamentoDataTipo.mockResolvedValue(
      new LevantamentoBuilder().withId('lev-i').build(),
    );
    readRepo.findSlaConfig.mockResolvedValue(null);
    writeRepo.criarItemManual.mockResolvedValue({
      id: 'item-1',
      levantamentoId: 'lev-i',
      createdAt: new Date(),
    });

    await useCase.execute(baseInput);

    expect(writeRepo.incrementTotalItens).toHaveBeenCalledWith('lev-i');
  });

  it('deve resolver slaHoras a partir de sla_config quando não informado', async () => {
    readRepo.findPlanejamento.mockResolvedValue(planejamentoAtivo);
    readRepo.findByPlanejamentoDataTipo.mockResolvedValue(
      new LevantamentoBuilder().withId('lev-s').build(),
    );
    readRepo.findSlaConfig.mockResolvedValue({
      config: { sla_horas: 72 },
    });
    writeRepo.criarItemManual.mockResolvedValue({
      id: 'item-1',
      levantamentoId: 'lev-s',
      createdAt: new Date(),
    });

    await useCase.execute({ ...baseInput, slaHoras: undefined });

    expect(writeRepo.criarItemManual).toHaveBeenCalledWith(
      expect.objectContaining({ slaHoras: 72 }),
    );
  });

  it('deve chamar criarItemTags quando tags forem informadas', async () => {
    readRepo.findPlanejamento.mockResolvedValue(planejamentoAtivo);
    readRepo.findByPlanejamentoDataTipo.mockResolvedValue(
      new LevantamentoBuilder().withId('lev-t').build(),
    );
    readRepo.findSlaConfig.mockResolvedValue(null);
    writeRepo.criarItemManual.mockResolvedValue({
      id: 'item-tags',
      levantamentoId: 'lev-t',
      createdAt: new Date(),
    });

    await useCase.execute({ ...baseInput, tags: ['a', 'b'] });

    expect(writeRepo.criarItemTags).toHaveBeenCalledWith('item-tags', ['a', 'b']);
  });

  it('deve invocar hook CriarFocoDeLevantamentoItem após criar item (best-effort)', async () => {
    readRepo.findPlanejamento.mockResolvedValue(planejamentoAtivo);
    readRepo.findByPlanejamentoDataTipo.mockResolvedValue(
      new LevantamentoBuilder().withId('lev-h').build(),
    );
    readRepo.findSlaConfig.mockResolvedValue(null);
    const now = new Date('2026-04-20');
    writeRepo.criarItemManual.mockResolvedValue({
      id: 'item-h',
      levantamentoId: 'lev-h',
      latitude: -10,
      longitude: -20,
      prioridade: 'P1',
      risco: 'alto',
      enderecoCurto: 'Rua Y',
      createdAt: now,
    });

    await useCase.execute(baseInput);

    expect(criarFoco.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: 'item-h',
        levantamentoId: 'lev-h',
        latitude: -10,
        longitude: -20,
        prioridade: 'P1',
      }),
    );
  });

  it('quota ok → cria item manual normalmente', async () => {
    readRepo.findPlanejamento.mockResolvedValue(planejamentoAtivo);
    readRepo.findByPlanejamentoDataTipo.mockResolvedValue(new LevantamentoBuilder().withId('lev-q').build());
    readRepo.findSlaConfig.mockResolvedValue(null);
    writeRepo.criarItemManual.mockResolvedValue({ id: 'item-q', levantamentoId: 'lev-q', createdAt: new Date() });

    await useCase.execute(baseInput);

    expect(mockVerificarQuota.execute).toHaveBeenCalledWith('test-cliente-id', { metrica: 'itens_mes' });
    expect(writeRepo.criarItemManual).toHaveBeenCalled();
  });

  it('quota excedida → throw ForbiddenException antes de criar item', async () => {
    readRepo.findPlanejamento.mockResolvedValue(planejamentoAtivo);
    mockVerificarQuota.execute.mockResolvedValue({ ok: false, usado: 50, limite: 50, motivo: 'excedido' });

    await expect(useCase.execute(baseInput)).rejects.toThrow(ForbiddenException);

    expect(writeRepo.criarItemManual).not.toHaveBeenCalled();
  });

  it('falha no hook não deve quebrar o use-case', async () => {
    readRepo.findPlanejamento.mockResolvedValue(planejamentoAtivo);
    readRepo.findByPlanejamentoDataTipo.mockResolvedValue(
      new LevantamentoBuilder().withId('lev-e').build(),
    );
    readRepo.findSlaConfig.mockResolvedValue(null);
    writeRepo.criarItemManual.mockResolvedValue({
      id: 'item-err',
      levantamentoId: 'lev-e',
      createdAt: new Date(),
    });
    criarFoco.execute.mockRejectedValueOnce(new Error('boom'));

    const r = await useCase.execute(baseInput);
    expect(r.levantamentoItem.id).toBe('item-err');
  });
});
