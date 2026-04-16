import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { mock } from 'jest-mock-extended';

import { expectHttpException } from '@test/utils/expect-http-exception';
import { mockRequest } from '@test/utils/user-helpers';

import { QuarteiraoException } from '../../errors/quarteirao.exception';
import { QuarteiraoWriteRepository } from '../../repositories/quarteirao-write.repository';
import { CreateDistribuicao } from '../create-distribuicao';
import { DistribuicaoBuilder } from './builders/quarteirao.builder';

describe('CreateDistribuicao', () => {
  let useCase: CreateDistribuicao;
  const writeRepo = mock<QuarteiraoWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateDistribuicao,
        { provide: QuarteiraoWriteRepository, useValue: writeRepo },
        { provide: 'REQUEST', useValue: mockRequest({ tenantId: 'test-cliente-id' }) },
      ],
    }).compile();

    useCase = module.get<CreateDistribuicao>(CreateDistribuicao);
  });

  it('deve criar distribuição com dados do input', async () => {
    const d = new DistribuicaoBuilder().build();
    writeRepo.createDistribuicao.mockResolvedValue(d);

    const result = await useCase.execute({
      clienteId: 'test-cliente-id',
      ciclo: 2,
      quarteirao: 'Q002',
      agenteId: '99999999-9999-4999-8999-999999999999',
    });

    expect(result.distribuicao).toEqual(d);
    expect(writeRepo.createDistribuicao).toHaveBeenCalled();
  });

  it('deve mapear P2002 para conflictDistribuicao', async () => {
    const err = new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: [] },
    });
    writeRepo.createDistribuicao.mockRejectedValue(err);

    await expectHttpException(
      () =>
        useCase.execute({
          clienteId: 'test-cliente-id',
          ciclo: 1,
          quarteirao: 'Q',
          agenteId: '99999999-9999-4999-8999-999999999999',
        }),
      QuarteiraoException.conflictDistribuicao(),
    );
  });

  it('deve rejeitar non-admin acessando outro tenant', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateDistribuicao,
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
    const uc = module.get<CreateDistribuicao>(CreateDistribuicao);

    await expectHttpException(
      () =>
        uc.execute({
          clienteId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          ciclo: 1,
          quarteirao: 'Q',
          agenteId: '99999999-9999-4999-8999-999999999999',
        }),
      QuarteiraoException.forbiddenTenant(),
    );
    expect(writeRepo.createDistribuicao).not.toHaveBeenCalled();
  });

  it('deve rejeitar clienteId ausente', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateDistribuicao,
        { provide: QuarteiraoWriteRepository, useValue: writeRepo },
        { provide: 'REQUEST', useValue: mockRequest({ tenantId: '' }) },
      ],
    }).compile();
    const uc = module.get<CreateDistribuicao>(CreateDistribuicao);

    await expectHttpException(
      () =>
        uc.execute({
          ciclo: 1,
          quarteirao: 'Q',
          agenteId: '99999999-9999-4999-8999-999999999999',
        }),
      QuarteiraoException.badRequest(),
    );
  });
});
