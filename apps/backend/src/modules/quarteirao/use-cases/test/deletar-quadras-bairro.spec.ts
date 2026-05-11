import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { expectHttpException } from '@test/utils/expect-http-exception';
import { mockRequest } from '@test/utils/user-helpers';

import { QuarteiraoException } from '../../errors/quarteirao.exception';
import { QuarteiraoReadRepository } from '../../repositories/quarteirao-read.repository';
import { QuarteiraoWriteRepository } from '../../repositories/quarteirao-write.repository';
import { DeletarQuadrasBairro } from '../deletar-quadras-bairro';

const BAIRRO_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CLIENTE_ID = 'test-cliente-id';

describe('DeletarQuadrasBairro', () => {
  let useCase: DeletarQuadrasBairro;
  const readRepo = mock<QuarteiraoReadRepository>();
  const writeRepo = mock<QuarteiraoWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeletarQuadrasBairro,
        { provide: QuarteiraoReadRepository, useValue: readRepo },
        { provide: QuarteiraoWriteRepository, useValue: writeRepo },
        { provide: 'REQUEST', useValue: mockRequest() },
      ],
    }).compile();

    useCase = await module.resolve<DeletarQuadrasBairro>(DeletarQuadrasBairro);
  });

  it('deve deletar quadras quando bairro não tem distribuições', async () => {
    readRepo.countDistribuicoesByBairroId.mockResolvedValue(0);
    writeRepo.deletarQuadrasBairro.mockResolvedValue({ deletadas: 11 });

    const result = await useCase.execute(BAIRRO_ID);

    expect(result).toEqual({ deletadas: 11 });
    expect(readRepo.countDistribuicoesByBairroId).toHaveBeenCalledWith(CLIENTE_ID, BAIRRO_ID);
    expect(writeRepo.deletarQuadrasBairro).toHaveBeenCalledWith(CLIENTE_ID, BAIRRO_ID);
  });

  it('deve retornar { deletadas: 0 } quando bairro não tem quadras', async () => {
    readRepo.countDistribuicoesByBairroId.mockResolvedValue(0);
    writeRepo.deletarQuadrasBairro.mockResolvedValue({ deletadas: 0 });

    const result = await useCase.execute(BAIRRO_ID);

    expect(result).toEqual({ deletadas: 0 });
    expect(writeRepo.deletarQuadrasBairro).toHaveBeenCalled();
  });

  it('deve rejeitar quando bairro já tem distribuições', async () => {
    readRepo.countDistribuicoesByBairroId.mockResolvedValue(3);

    await expectHttpException(
      () => useCase.execute(BAIRRO_ID),
      QuarteiraoException.bairroComDistribuicoes(),
    );

    expect(writeRepo.deletarQuadrasBairro).not.toHaveBeenCalled();
  });
});
