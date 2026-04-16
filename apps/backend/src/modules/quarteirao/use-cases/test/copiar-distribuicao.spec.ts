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

    useCase = module.get<CopiarDistribuicao>(CopiarDistribuicao);
  });

  it('deve copiar distribuições de cicloOrigem para cicloDestino', async () => {
    writeRepo.copiarDistribuicoesCiclo.mockResolvedValue({ copiadas: 3 });

    const result = await useCase.execute({
      cicloOrigem: 1,
      cicloDestino: 2,
      clienteId: 'test-cliente-id',
    });

    expect(writeRepo.copiarDistribuicoesCiclo).toHaveBeenCalledWith({
      clienteId: 'test-cliente-id',
      cicloOrigem: 1,
      cicloDestino: 2,
    });
    expect(result).toEqual({ copiadas: 3 });
  });

  it('deve rejeitar cicloOrigem === cicloDestino', async () => {
    await expectHttpException(
      () =>
        useCase.execute({
          cicloOrigem: 5,
          cicloDestino: 5,
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
    const uc = module.get<CopiarDistribuicao>(CopiarDistribuicao);

    await expectHttpException(
      () =>
        uc.execute({
          cicloOrigem: 1,
          cicloDestino: 2,
        }),
      QuarteiraoException.badRequest(),
    );
  });
});
