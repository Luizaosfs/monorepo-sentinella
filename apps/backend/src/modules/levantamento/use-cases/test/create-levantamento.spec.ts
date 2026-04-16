import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { LevantamentoWriteRepository } from '../../repositories/levantamento-write.repository';
import { mockRequest } from '@test/utils/user-helpers';

import { CreateLevantamento } from '../create-levantamento';
import { LevantamentoBuilder } from './builders/levantamento.builder';

describe('CreateLevantamento', () => {
  let useCase: CreateLevantamento;
  const writeRepo = mock<LevantamentoWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateLevantamento,
        { provide: LevantamentoWriteRepository, useValue: writeRepo },
        { provide: 'REQUEST', useValue: mockRequest({ tenantId: 'tenant-uuid', user: { id: 'user-uuid', email: 'u@t.com', nome: 'U', clienteId: 'tenant-uuid', papeis: ['admin'] } }) },
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
