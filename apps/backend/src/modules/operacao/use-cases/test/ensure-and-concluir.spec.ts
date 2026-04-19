import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { mockRequest } from '@test/utils/user-helpers';

import { EnsureAndConcluirInput } from '../../dtos/ensure-and-concluir.body';
import { OperacaoWriteRepository } from '../../repositories/operacao-write.repository';

import { EnsureAndConcluir } from '../ensure-and-concluir';
import { OperacaoBuilder } from './builders/operacao.builder';

const itemId = 'a0000000-0000-4000-8000-000000000001';

const mockPrismaOperacoes = {
  findFirst: jest.fn(),
  update: jest.fn(),
  findUniqueOrThrow: jest.fn(),
};
const mockPrisma = { client: { operacoes: mockPrismaOperacoes } };

describe('EnsureAndConcluir', () => {
  let useCase: EnsureAndConcluir;
  const writeRepo = mock<OperacaoWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnsureAndConcluir,
        { provide: OperacaoWriteRepository, useValue: writeRepo },
        { provide: REQUEST, useValue: mockRequest({ tenantId: 'test-cliente-id' }) },
      ],
    })
      .overrideProvider(EnsureAndConcluir)
      .useFactory({
        factory: () =>
          new EnsureAndConcluir(
            mockPrisma as any,
            writeRepo,
            mockRequest({ tenantId: 'test-cliente-id' }) as any,
          ),
      })
      .compile();
    useCase = module.get<EnsureAndConcluir>(EnsureAndConcluir);
  });

  it('deve criar operação concluída quando não existe', async () => {
    mockPrismaOperacoes.findFirst.mockResolvedValue(null);
    const created = new OperacaoBuilder().withStatus('concluido').withItemLevantamentoId(itemId).build();
    writeRepo.create.mockResolvedValue(created);

    const data: EnsureAndConcluirInput = { itemLevantamentoId: itemId };
    const result = await useCase.execute(data);

    expect(writeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'concluido', concluidoEm: expect.any(Date) }),
    );
    expect(result.operacao).toBe(created);
  });

  it('deve concluir operação existente e preservar iniciado_em original', async () => {
    const originalDate = new Date('2026-01-01');
    const rawExisting = { id: 'op-1', status: 'em_andamento', cliente_id: 'test-cliente-id', iniciado_em: originalDate, concluido_em: null };
    const rawUpdated = { ...rawExisting, status: 'concluido', concluido_em: new Date(), responsavel_id: null, prioridade: null, observacao: null, tipo_vinculo: 'levantamento', item_levantamento_id: itemId, foco_risco_id: null, regiao_id: null };
    mockPrismaOperacoes.findFirst.mockResolvedValue(rawExisting);
    mockPrismaOperacoes.update.mockResolvedValue(rawUpdated);
    mockPrismaOperacoes.findUniqueOrThrow.mockResolvedValue(rawUpdated);

    const result = await useCase.execute({ itemLevantamentoId: itemId });

    expect(mockPrismaOperacoes.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'concluido', iniciado_em: originalDate }),
      }),
    );
    expect(result.operacao.status).toBe('concluido');
  });
});
