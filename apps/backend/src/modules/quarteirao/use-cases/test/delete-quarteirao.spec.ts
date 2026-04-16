import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { expectHttpException } from '@test/utils/expect-http-exception';
import { mockRequest } from '@test/utils/user-helpers';

import { QuarteiraoException } from '../../errors/quarteirao.exception';
import { QuarteiraoReadRepository } from '../../repositories/quarteirao-read.repository';
import { QuarteiraoWriteRepository } from '../../repositories/quarteirao-write.repository';
import { DeleteQuarteirao } from '../delete-quarteirao';
import { QuarteiraoBuilder } from './builders/quarteirao.builder';

describe('DeleteQuarteirao', () => {
  let useCase: DeleteQuarteirao;
  const readRepo = mock<QuarteiraoReadRepository>();
  const writeRepo = mock<QuarteiraoWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteQuarteirao,
        { provide: QuarteiraoReadRepository, useValue: readRepo },
        { provide: QuarteiraoWriteRepository, useValue: writeRepo },
        { provide: 'REQUEST', useValue: mockRequest() },
      ],
    }).compile();

    useCase = module.get<DeleteQuarteirao>(DeleteQuarteirao);
  });

  it('deve soft delete quarteirão com userId', async () => {
    const q = new QuarteiraoBuilder().build();
    readRepo.findQuarteiraoById.mockResolvedValue(q);
    writeRepo.softDeleteQuarteirao.mockResolvedValue();

    const result = await useCase.execute(q.id!);

    expect(result.id).toBe(q.id);
    expect(writeRepo.softDeleteQuarteirao).toHaveBeenCalledWith(q.id, 'test-user-id');
  });

  it('deve rejeitar não encontrado', async () => {
    readRepo.findQuarteiraoById.mockResolvedValue(null);

    await expectHttpException(() => useCase.execute('missing'), QuarteiraoException.notFound());
    expect(writeRepo.softDeleteQuarteirao).not.toHaveBeenCalled();
  });

  it('deve rejeitar tenant diferente', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteQuarteirao,
        { provide: QuarteiraoReadRepository, useValue: readRepo },
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
              papeis: ['agente'],
            },
          }),
        },
      ],
    }).compile();
    const uc = module.get<DeleteQuarteirao>(DeleteQuarteirao);

    const q = new QuarteiraoBuilder().withClienteId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa').build();
    readRepo.findQuarteiraoById.mockResolvedValue(q);

    await expectHttpException(() => uc.execute(q.id!), QuarteiraoException.forbiddenTenant());
    expect(writeRepo.softDeleteQuarteirao).not.toHaveBeenCalled();
  });
});
