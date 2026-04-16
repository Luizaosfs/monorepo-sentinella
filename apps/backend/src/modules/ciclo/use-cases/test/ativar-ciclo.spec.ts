import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { CicloException } from '../../errors/ciclo.exception';
import { CicloReadRepository } from '../../repositories/ciclo-read.repository';
import { CicloWriteRepository } from '../../repositories/ciclo-write.repository';
import { expectHttpException } from '@test/utils/expect-http-exception';
import { mockRequest } from '@test/utils/user-helpers';

import { AtivarCiclo } from '../ativar-ciclo';
import { CicloBuilder } from './builders/ciclo.builder';

describe('AtivarCiclo', () => {
  let useCase: AtivarCiclo;
  const readRepo = mock<CicloReadRepository>();
  const writeRepo = mock<CicloWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AtivarCiclo,
        { provide: CicloReadRepository, useValue: readRepo },
        { provide: CicloWriteRepository, useValue: writeRepo },
        { provide: 'REQUEST', useValue: mockRequest({ tenantId: 'test-cliente-id' }) },
      ],
    }).compile();
    useCase = module.get<AtivarCiclo>(AtivarCiclo);
  });

  it('deve desativar todos os ciclos do cliente e ativar o ciclo encontrado (status=ativo)', async () => {
    const ciclo = new CicloBuilder().withId('ativar-me').withStatus('planejamento').build();
    readRepo.findById.mockResolvedValue(ciclo);
    writeRepo.desativarTodos.mockResolvedValue();
    writeRepo.save.mockResolvedValue();

    const result = await useCase.execute('ativar-me');

    expect(writeRepo.desativarTodos).toHaveBeenCalledWith('test-cliente-id');
    expect(writeRepo.desativarTodos.mock.invocationCallOrder[0]).toBeLessThan(
      writeRepo.save.mock.invocationCallOrder[0],
    );
    expect(ciclo.status).toBe('ativo');
    expect(writeRepo.save).toHaveBeenCalledWith(ciclo);
    expect(result.ciclo).toBe(ciclo);
  });

  it('deve rejeitar ciclo não encontrado', async () => {
    readRepo.findById.mockResolvedValue(null);

    await expectHttpException(() => useCase.execute('nao-existe'), CicloException.notFound());
    expect(writeRepo.desativarTodos).not.toHaveBeenCalled();
  });
});
