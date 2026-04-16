import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { expectHttpException } from '@test/utils/expect-http-exception';
import { mockRequest } from '@test/utils/user-helpers';

import { ReinspecaoException } from '../../errors/reinspecao.exception';
import { ReinspecaoReadRepository } from '../../repositories/reinspecao-read.repository';
import { ReinspecaoWriteRepository } from '../../repositories/reinspecao-write.repository';
import { ReagendarReinspecao } from '../reagendar';
import { ReinspecaoBuilder } from './builders/reinspecao.builder';

describe('ReagendarReinspecao', () => {
  let useCase: ReagendarReinspecao;
  const readRepo = mock<ReinspecaoReadRepository>();
  const writeRepo = mock<ReinspecaoWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReagendarReinspecao,
        { provide: ReinspecaoReadRepository, useValue: readRepo },
        { provide: ReinspecaoWriteRepository, useValue: writeRepo },
        { provide: 'REQUEST', useValue: mockRequest() },
      ],
    }).compile();

    useCase = module.get<ReagendarReinspecao>(ReagendarReinspecao);
  });

  it('deve reagendar reinspeção pendente com nova dataPrevista', async () => {
    const r = new ReinspecaoBuilder().withStatus('pendente').build();
    readRepo.findById.mockResolvedValue(r);
    writeRepo.save.mockResolvedValue();

    const nova = new Date('2024-12-01');
    const result = await useCase.execute(r.id!, { dataPrevista: nova });

    expect(result.reinspecao.dataPrevista).toEqual(nova);
    expect(writeRepo.save).toHaveBeenCalled();
  });

  it('deve rejeitar não encontrada', async () => {
    readRepo.findById.mockResolvedValue(null);

    await expectHttpException(
      () => useCase.execute('missing-id', { dataPrevista: new Date() }),
      ReinspecaoException.notFound(),
    );
  });

  it('deve rejeitar status != pendente', async () => {
    const r = new ReinspecaoBuilder().withStatus('cancelada').build();
    readRepo.findById.mockResolvedValue(r);

    await expectHttpException(
      () => useCase.execute(r.id!, { dataPrevista: new Date() }),
      ReinspecaoException.badRequest(),
    );
    expect(writeRepo.save).not.toHaveBeenCalled();
  });
});
