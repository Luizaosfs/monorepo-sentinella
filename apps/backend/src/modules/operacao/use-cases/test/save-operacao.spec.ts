import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { expectHttpException } from '@test/utils/expect-http-exception';
import { mockRequest } from '@test/utils/user-helpers';

import { SaveOperacaoBody } from '../../dtos/save-operacao.body';
import { OperacaoException } from '../../errors/operacao.exception';
import { OperacaoReadRepository } from '../../repositories/operacao-read.repository';
import { OperacaoWriteRepository } from '../../repositories/operacao-write.repository';
import { SaveOperacao } from '../save-operacao';
import { OperacaoBuilder } from './builders/operacao.builder';

describe('SaveOperacao', () => {
  let useCase: SaveOperacao;
  const readRepo = mock<OperacaoReadRepository>();
  const writeRepo = mock<OperacaoWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaveOperacao,
        { provide: OperacaoReadRepository, useValue: readRepo },
        { provide: OperacaoWriteRepository, useValue: writeRepo },
        { provide: REQUEST, useValue: mockRequest() },
      ],
    }).compile();
    useCase = module.get<SaveOperacao>(SaveOperacao);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('deve atualizar campos parciais (status, prioridade, responsavelId, observacao)', async () => {
    const op = new OperacaoBuilder().withStatus('pendente').build();
    readRepo.findById.mockResolvedValue(op);
    writeRepo.save.mockResolvedValue();

    await useCase.execute(op.id!, {
      prioridade: 'P1',
      responsavelId: 'c3333333-3333-4333-8333-333333333333',
      observacao: 'obs',
    } as SaveOperacaoBody);

    expect(op.prioridade).toBe('P1');
    expect(op.responsavelId).toBe('c3333333-3333-4333-8333-333333333333');
    expect(op.observacao).toBe('obs');
    expect(writeRepo.save).toHaveBeenCalledWith(op);
  });

  it('deve preencher iniciadoEm ao mudar pendente → em_andamento', async () => {
    const agora = new Date('2026-01-15T08:00:00Z');
    jest.setSystemTime(agora);

    const op = new OperacaoBuilder().withStatus('pendente').build();
    readRepo.findById.mockResolvedValue(op);
    writeRepo.save.mockResolvedValue();

    await useCase.execute(op.id!, { status: 'em_andamento' } as SaveOperacaoBody);

    expect(op.status).toBe('em_andamento');
    expect(op.iniciadoEm?.getTime()).toBe(agora.getTime());
  });

  it("deve preencher concluidoEm ao mudar para 'concluido' (se não preenchido)", async () => {
    const agora = new Date('2026-02-01T09:00:00Z');
    jest.setSystemTime(agora);

    const op = new OperacaoBuilder().withStatus('em_andamento').build();
    readRepo.findById.mockResolvedValue(op);
    writeRepo.save.mockResolvedValue();

    await useCase.execute(op.id!, { status: 'concluido' } as SaveOperacaoBody);

    expect(op.concluidoEm?.getTime()).toBe(agora.getTime());
  });

  it('NÃO deve sobrescrever concluidoEm existente ao concluir', async () => {
    jest.setSystemTime(new Date('2026-02-01T09:00:00Z'));

    const existente = new Date('2025-12-01T00:00:00Z');
    const op = new OperacaoBuilder().withStatus('em_andamento').withConcluidoEm(existente).build();
    readRepo.findById.mockResolvedValue(op);
    writeRepo.save.mockResolvedValue();

    await useCase.execute(op.id!, { status: 'concluido' } as SaveOperacaoBody);

    expect(op.concluidoEm?.getTime()).toBe(existente.getTime());
  });

  it('deve rejeitar não encontrada', async () => {
    readRepo.findById.mockResolvedValue(null);

    await expectHttpException(
      () => useCase.execute('x', { status: 'concluido' } as SaveOperacaoBody),
      OperacaoException.notFound(),
    );
    expect(writeRepo.save).not.toHaveBeenCalled();
  });
});
