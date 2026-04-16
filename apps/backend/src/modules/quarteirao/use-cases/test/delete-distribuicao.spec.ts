import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { expectHttpException } from '@test/utils/expect-http-exception';
import { mockRequest } from '@test/utils/user-helpers';

import { QuarteiraoException } from '../../errors/quarteirao.exception';
import { QuarteiraoReadRepository } from '../../repositories/quarteirao-read.repository';
import { QuarteiraoWriteRepository } from '../../repositories/quarteirao-write.repository';
import { DeleteDistribuicao } from '../delete-distribuicao';
import { DistribuicaoBuilder } from './builders/quarteirao.builder';

describe('DeleteDistribuicao', () => {
  let useCase: DeleteDistribuicao;
  const readRepo = mock<QuarteiraoReadRepository>();
  const writeRepo = mock<QuarteiraoWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteDistribuicao,
        { provide: QuarteiraoReadRepository, useValue: readRepo },
        { provide: QuarteiraoWriteRepository, useValue: writeRepo },
        { provide: 'REQUEST', useValue: mockRequest() },
      ],
    }).compile();

    useCase = module.get<DeleteDistribuicao>(DeleteDistribuicao);
  });

  it('deve deletar distribuição existente', async () => {
    const row = new DistribuicaoBuilder().build();
    readRepo.findDistribuicaoById.mockResolvedValue(row);
    writeRepo.deleteDistribuicao.mockResolvedValue();

    const result = await useCase.execute(row.id!);

    expect(result.id).toBe(row.id);
    expect(writeRepo.deleteDistribuicao).toHaveBeenCalledWith(row.id);
  });

  it('deve rejeitar não encontrada', async () => {
    readRepo.findDistribuicaoById.mockResolvedValue(null);

    await expectHttpException(() => useCase.execute('x'), QuarteiraoException.distribuicaoNotFound());
    expect(writeRepo.deleteDistribuicao).not.toHaveBeenCalled();
  });

  it('deve rejeitar tenant diferente', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeleteDistribuicao,
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
              papeis: ['supervisor'],
            },
          }),
        },
      ],
    }).compile();
    const uc = module.get<DeleteDistribuicao>(DeleteDistribuicao);

    const row = new DistribuicaoBuilder().withClienteId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa').build();
    readRepo.findDistribuicaoById.mockResolvedValue(row);

    await expectHttpException(() => uc.execute(row.id!), QuarteiraoException.forbiddenTenant());
  });
});
