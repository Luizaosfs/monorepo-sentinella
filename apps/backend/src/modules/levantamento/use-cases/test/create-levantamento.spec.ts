import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { ForbiddenException } from '@nestjs/common';

import { VerificarQuota } from '../../../billing/use-cases/verificar-quota';
import { LevantamentoWriteRepository } from '../../repositories/levantamento-write.repository';
import { mockRequest } from '@test/utils/user-helpers';

import { CreateLevantamento } from '../create-levantamento';
import { LevantamentoBuilder } from './builders/levantamento.builder';

describe('CreateLevantamento', () => {
  let useCase: CreateLevantamento;
  const writeRepo = mock<LevantamentoWriteRepository>();
  const mockVerificarQuota = { execute: jest.fn().mockResolvedValue({ ok: true, usado: 0, limite: null }) };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockVerificarQuota.execute.mockResolvedValue({ ok: true, usado: 0, limite: null });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateLevantamento,
        { provide: LevantamentoWriteRepository, useValue: writeRepo },
        { provide: 'REQUEST', useValue: mockRequest({ tenantId: 'tenant-uuid', user: { id: 'user-uuid', email: 'u@t.com', nome: 'U', clienteId: 'tenant-uuid', papeis: ['admin'] } }) },
        { provide: VerificarQuota, useValue: mockVerificarQuota },
      ],
    }).compile();

    useCase = module.get<CreateLevantamento>(CreateLevantamento);
  });

  it('deve criar levantamento com clienteId do tenant e usuarioId do user', async () => {
    const created = new LevantamentoBuilder()
      .withClienteId('tenant-uuid')
      .withUsuarioId('user-uuid')
      .build();
    writeRepo.create.mockResolvedValue(created);

    await useCase.execute({});

    expect(writeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        clienteId: 'tenant-uuid',
        usuarioId: 'user-uuid',
      }),
    );
  });

  it("deve usar statusProcessamento='aguardando' e totalItens=0", async () => {
    const created = new LevantamentoBuilder().build();
    writeRepo.create.mockResolvedValue(created);

    await useCase.execute({});

    expect(writeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        statusProcessamento: 'aguardando',
        totalItens: 0,
      }),
    );
  });

  it('quota ok → cria levantamento normalmente', async () => {
    const created = new LevantamentoBuilder().build();
    writeRepo.create.mockResolvedValue(created);

    const result = await useCase.execute({});

    expect(result.levantamento).toBe(created);
    expect(mockVerificarQuota.execute).toHaveBeenCalledWith('tenant-uuid', { metrica: 'levantamentos_mes' });
  });

  it('quota excedida → throw ForbiddenException antes de criar', async () => {
    mockVerificarQuota.execute.mockResolvedValue({ ok: false, usado: 5, limite: 5, motivo: 'excedido' });

    await expect(useCase.execute({})).rejects.toThrow(ForbiddenException);

    expect(writeRepo.create).not.toHaveBeenCalled();
  });

  it('deve propagar cicloId e observacao do input', async () => {
    const created = new LevantamentoBuilder().withCicloId('ciclo-uuid').withObservacao('obs').build();
    writeRepo.create.mockResolvedValue(created);

    await useCase.execute({
      cicloId: 'ciclo-uuid',
      observacao: 'obs',
    });

    expect(writeRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        cicloId: 'ciclo-uuid',
        observacao: 'obs',
      }),
    );
  });
});
