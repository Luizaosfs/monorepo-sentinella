import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { mockRequest } from '@test/utils/user-helpers';

import { EnsureEmAndamentoInput } from '../../dtos/ensure-em-andamento.body';
import { OperacaoWriteRepository } from '../../repositories/operacao-write.repository';

import { EnsureEmAndamento } from '../ensure-em-andamento';
import { OperacaoBuilder } from './builders/operacao.builder';

const itemId = 'a0000000-0000-4000-8000-000000000001';

const mockPrismaOperacoes = {
  findFirst: jest.fn(),
  update: jest.fn(),
  findUniqueOrThrow: jest.fn(),
};
const mockPrisma = { client: { operacoes: mockPrismaOperacoes } };

describe('EnsureEmAndamento', () => {
  let useCase: EnsureEmAndamento;
  const writeRepo = mock<OperacaoWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnsureEmAndamento,
        { provide: OperacaoWriteRepository, useValue: writeRepo },
        { provide: REQUEST, useValue: mockRequest({ tenantId: 'test-cliente-id' }) },
      ],
    })
      .overrideProvider(EnsureEmAndamento)
      .useFactory({
        factory: () =>
          new EnsureEmAndamento(
            mockPrisma as any,
            writeRepo,
            mockRequest({ tenantId: 'test-cliente-id' }) as any,
          ),
      })
      .compile();
    useCase = module.get<EnsureEmAndamento>(EnsureEmAndamento);
  });

  it('deve criar operação em_andamento quando não existe', async () => {
    mockPrismaOperacoes.findFirst.mockResolvedValue(null);
    const created = new OperacaoBuilder().withStatus('em_andamento').withItemLevantamentoId(itemId).build();
    writeRepo.create.mockResolvedValue(created);

    const data: EnsureEmAndamentoInput = { itemLevantamentoId: itemId };
    const result = await useCase.execute(data);

    expect(writeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'em_andamento', itemLevantamentoId: itemId }),
    );
    expect(result.operacao).toBe(created);
  });

  it('deve atualizar status para em_andamento quando operação existe com outro status', async () => {
    const rawExisting = { id: 'op-1', status: 'pendente', cliente_id: 'test-cliente-id', iniciado_em: null };
    const rawUpdated = { ...rawExisting, status: 'em_andamento', iniciado_em: new Date(), responsavel_id: null, prioridade: null, observacao: null, concluido_em: null, tipo_vinculo: 'levantamento', item_levantamento_id: itemId, foco_risco_id: null, regiao_id: null };
    mockPrismaOperacoes.findFirst.mockResolvedValue(rawExisting);
    mockPrismaOperacoes.update.mockResolvedValue(rawUpdated);
    mockPrismaOperacoes.findUniqueOrThrow.mockResolvedValue(rawUpdated);

    const result = await useCase.execute({ itemLevantamentoId: itemId });

    expect(mockPrismaOperacoes.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'op-1' } }),
    );
    expect(result.operacao.status).toBe('em_andamento');
  });
});
