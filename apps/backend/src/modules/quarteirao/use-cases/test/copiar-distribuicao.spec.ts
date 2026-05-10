import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { expectHttpException } from '@test/utils/expect-http-exception';
import { mockRequest } from '@test/utils/user-helpers';

import { QuarteiraoException } from '../../errors/quarteirao.exception';
import { QuarteiraoWriteRepository } from '../../repositories/quarteirao-write.repository';
import { CopiarDistribuicao } from '../copiar-distribuicao';

describe('CopiarDistribuicao', () => {
  let useCase: CopiarDistribuicao;
  const writeRepo = mock<QuarteiraoWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CopiarDistribuicao,
        { provide: QuarteiraoWriteRepository, useValue: writeRepo },
        { provide: 'REQUEST', useValue: mockRequest({ tenantId: 'test-cliente-id' }) },
      ],
    }).compile();

    useCase = await module.resolve<CopiarDistribuicao>(CopiarDistribuicao);
  });

  it('deve copiar distribuições de cicloOrigemId para cicloDestinoId', async () => {
    writeRepo.copiarDistribuicoesCiclo.mockResolvedValue({ copiadas: 3 });

    const result = await useCase.execute({
      cicloOrigemId:  'ciclo-uuid-1',
      cicloDestinoId: 'ciclo-uuid-2',
      clienteId: 'test-cliente-id',
    });

    expect(writeRepo.copiarDistribuicoesCiclo).toHaveBeenCalledWith({
      clienteId:      'test-cliente-id',
      cicloOrigemId:  'ciclo-uuid-1',
      cicloDestinoId: 'ciclo-uuid-2',
    });
    expect(result).toEqual({ copiadas: 3 });
  });

  it('deve rejeitar cicloOrigemId === cicloDestinoId', async () => {
    await expectHttpException(
      () =>
        useCase.execute({
          cicloOrigemId:  'ciclo-uuid-5',
          cicloDestinoId: 'ciclo-uuid-5',
          clienteId: 'test-cliente-id',
        }),
      QuarteiraoException.badRequest(),
    );
    expect(writeRepo.copiarDistribuicoesCiclo).not.toHaveBeenCalled();
  });

  it('deve rejeitar clienteId ausente', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CopiarDistribuicao,
        { provide: QuarteiraoWriteRepository, useValue: writeRepo },
        { provide: 'REQUEST', useValue: mockRequest({ tenantId: '' }) },
      ],
    }).compile();
    const uc = await module.resolve<CopiarDistribuicao>(CopiarDistribuicao);

    await expectHttpException(
      () =>
        uc.execute({
          cicloOrigemId:  'ciclo-uuid-1',
          cicloDestinoId: 'ciclo-uuid-2',
        }),
      QuarteiraoException.badRequest(),
    );
  });
});
