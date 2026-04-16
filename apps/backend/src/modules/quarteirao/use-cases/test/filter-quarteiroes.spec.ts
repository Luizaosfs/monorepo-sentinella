import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { expectHttpException } from '@test/utils/expect-http-exception';
import { mockRequest } from '@test/utils/user-helpers';

import { QuarteiraoException } from '../../errors/quarteirao.exception';
import { QuarteiraoReadRepository } from '../../repositories/quarteirao-read.repository';
import { FilterQuarteiroes } from '../filter-quarteiroes';
import { QuarteiraoBuilder } from './builders/quarteirao.builder';

describe('FilterQuarteiroes', () => {
  let useCase: FilterQuarteiroes;
  const readRepo = mock<QuarteiraoReadRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilterQuarteiroes,
        { provide: QuarteiraoReadRepository, useValue: readRepo },
        { provide: 'REQUEST', useValue: mockRequest({ tenantId: 'test-cliente-id' }) },
      ],
    }).compile();

    useCase = module.get<FilterQuarteiroes>(FilterQuarteiroes);
  });

  it('deve usar clienteId do filtro ou fallback tenant e delegar ao findAllQuarteiroes', async () => {
    const list = [new QuarteiraoBuilder().build()];
    readRepo.findAllQuarteiroes.mockResolvedValue(list);

    const withFilter = await useCase.execute({
      clienteId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
    expect(readRepo.findAllQuarteiroes).toHaveBeenCalledWith(
      expect.objectContaining({ clienteId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }),
    );
    expect(withFilter.quarteiroes).toEqual(list);

    readRepo.findAllQuarteiroes.mockResolvedValue(list);
    await useCase.execute({});
    expect(readRepo.findAllQuarteiroes).toHaveBeenCalledWith(
      expect.objectContaining({ clienteId: 'test-cliente-id' }),
    );
  });

  it('deve rejeitar non-admin acessando outro tenant', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilterQuarteiroes,
        { provide: QuarteiraoReadRepository, useValue: readRepo },
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
    const uc = module.get<FilterQuarteiroes>(FilterQuarteiroes);

    await expectHttpException(
      () =>
        uc.execute({
          clienteId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        }),
      QuarteiraoException.forbiddenTenant(),
    );
    expect(readRepo.findAllQuarteiroes).not.toHaveBeenCalled();
  });
});
