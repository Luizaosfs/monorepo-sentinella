import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { mock } from 'jest-mock-extended';

import { expectHttpException } from '@test/utils/expect-http-exception';
import { mockRequest } from '@test/utils/user-helpers';

import { QuarteiraoException } from '../../errors/quarteirao.exception';
import { QuarteiraoWriteRepository } from '../../repositories/quarteirao-write.repository';
import { CreateQuarteirao } from '../create-quarteirao';
import { QuarteiraoBuilder } from './builders/quarteirao.builder';

describe('CreateQuarteirao', () => {
  let useCase: CreateQuarteirao;
  const writeRepo = mock<QuarteiraoWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateQuarteirao,
        { provide: QuarteiraoWriteRepository, useValue: writeRepo },
        { provide: 'REQUEST', useValue: mockRequest({ tenantId: 'test-cliente-id' }) },
      ],
    }).compile();

    useCase = module.get<CreateQuarteirao>(CreateQuarteirao);
  });

  it('deve criar quarteirão com ativo=true padrão e usar clienteId do input ou fallback tenant', async () => {
    const fromInput = new QuarteiraoBuilder()
      .withClienteId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
      .build();
    writeRepo.createQuarteirao.mockResolvedValue(fromInput);

    await useCase.execute({
      clienteId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      codigo: 'Q99',
    });

    expect(writeRepo.createQuarteirao).toHaveBeenCalledWith(
      expect.objectContaining({
        clienteId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        ativo: true,
      }),
    );

    const fallback = new QuarteiraoBuilder().build();
    writeRepo.createQuarteirao.mockResolvedValue(fallback);

    await useCase.execute({ codigo: 'Q1' });

    expect(writeRepo.createQuarteirao).toHaveBeenCalledWith(
      expect.objectContaining({ clienteId: 'test-cliente-id' }),
    );
  });

  it('deve mapear P2002 para conflict', async () => {
    const err = new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['codigo'] },
    });
    writeRepo.createQuarteirao.mockRejectedValue(err);

    await expectHttpException(
      () => useCase.execute({ codigo: 'dup', clienteId: 'test-cliente-id' }),
      QuarteiraoException.conflict(),
    );
  });

  it('deve rejeitar non-admin acessando outro tenant', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateQuarteirao,
        { provide: QuarteiraoWriteRepository, useValue: writeRepo },
        {
          provide: 'REQUEST',
          useValue: mockRequest({
            tenantId: 'test-cliente-id',
            user: {
              id: 'u',
              email: 'u@u.com',
              nome: 'U',
              clienteId: 'test-cliente-id',
              papeis: ['supervisor'],
            },
          }),
        },
      ],
    }).compile();
    const uc = module.get<CreateQuarteirao>(CreateQuarteirao);

    await expectHttpException(
      () =>
        uc.execute({
          clienteId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          codigo: 'X',
        }),
      QuarteiraoException.forbiddenTenant(),
    );
    expect(writeRepo.createQuarteirao).not.toHaveBeenCalled();
  });

  it('deve rejeitar clienteId ausente', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateQuarteirao,
        { provide: QuarteiraoWriteRepository, useValue: writeRepo },
        {
          provide: 'REQUEST',
          useValue: mockRequest({ tenantId: '' }),
        },
      ],
    }).compile();
    const uc = module.get<CreateQuarteirao>(CreateQuarteirao);

    await expectHttpException(() => uc.execute({ codigo: 'Q' }), QuarteiraoException.badRequest());
  });
});
