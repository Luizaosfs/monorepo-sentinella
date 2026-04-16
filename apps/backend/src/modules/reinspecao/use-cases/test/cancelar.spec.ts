import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { expectHttpException } from '@test/utils/expect-http-exception';
import { mockRequest } from '@test/utils/user-helpers';

import { ReinspecaoException } from '../../errors/reinspecao.exception';
import { ReinspecaoReadRepository } from '../../repositories/reinspecao-read.repository';
import { ReinspecaoWriteRepository } from '../../repositories/reinspecao-write.repository';
import { CancelarReinspecao } from '../cancelar';
import { ReinspecaoBuilder } from './builders/reinspecao.builder';

describe('CancelarReinspecao', () => {
  let useCase: CancelarReinspecao;
  const readRepo = mock<ReinspecaoReadRepository>();
  const writeRepo = mock<ReinspecaoWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CancelarReinspecao,
        { provide: ReinspecaoReadRepository, useValue: readRepo },
        { provide: ReinspecaoWriteRepository, useValue: writeRepo },
        {
          provide: 'REQUEST',
          useValue: mockRequest({
            user: {
              id: 'test-user-id',
              email: 'a@a.com',
              nome: 'Admin',
              clienteId: 'test-cliente-id',
              papeis: ['admin'],
            },
          }),
        },
      ],
    }).compile();

    useCase = module.get<CancelarReinspecao>(CancelarReinspecao);
  });

  it('deve cancelar reinspeção pendente com canceladoPor e motivoCancelamento', async () => {
    const r = new ReinspecaoBuilder().withStatus('pendente').build();
    readRepo.findById.mockResolvedValue(r);
    writeRepo.save.mockResolvedValue();

    const canceladoPor = '99999999-9999-4999-8999-999999999999';
    const result = await useCase.execute(r.id!, {
      motivoCancelamento: 'mudança de plano',
      canceladoPor,
    });

    expect(result.reinspecao.status).toBe('cancelada');
    expect(result.reinspecao.motivoCancelamento).toBe('mudança de plano');
    expect(result.reinspecao.canceladoPor).toBe(canceladoPor);
    expect(writeRepo.save).toHaveBeenCalled();
  });

  it('deve rejeitar não encontrada', async () => {
    readRepo.findById.mockResolvedValue(null);

    await expectHttpException(
      () =>
        useCase.execute('x', {
          motivoCancelamento: 'x',
        }),
      ReinspecaoException.notFound(),
    );
  });

  it('deve rejeitar status != pendente', async () => {
    const r = new ReinspecaoBuilder().withStatus('realizada').build();
    readRepo.findById.mockResolvedValue(r);

    await expectHttpException(
      () => useCase.execute(r.id!, { motivoCancelamento: 'x' }),
      ReinspecaoException.badRequest(),
    );
    expect(writeRepo.save).not.toHaveBeenCalled();
  });

  it('deve rejeitar tenant diferente (não admin)', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CancelarReinspecao,
        { provide: ReinspecaoReadRepository, useValue: readRepo },
        { provide: ReinspecaoWriteRepository, useValue: writeRepo },
        {
          provide: 'REQUEST',
          useValue: mockRequest({
            tenantId: 'test-cliente-id',
            user: {
              id: 'u1',
              email: 's@s.com',
              nome: 'Sup',
              clienteId: 'test-cliente-id',
              papeis: ['supervisor'],
            },
          }),
        },
      ],
    }).compile();
    const uc = module.get<CancelarReinspecao>(CancelarReinspecao);

    const r = new ReinspecaoBuilder()
      .withClienteId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
      .withStatus('pendente')
      .build();
    readRepo.findById.mockResolvedValue(r);

    await expectHttpException(
      () => uc.execute(r.id!, { motivoCancelamento: 'x' }),
      ReinspecaoException.forbiddenTenant(),
    );
  });
});
