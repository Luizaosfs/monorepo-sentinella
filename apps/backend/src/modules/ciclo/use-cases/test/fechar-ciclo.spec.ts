import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { CicloException } from '../../errors/ciclo.exception';
import { CicloReadRepository } from '../../repositories/ciclo-read.repository';
import { CicloWriteRepository } from '../../repositories/ciclo-write.repository';
import { expectHttpException } from '@test/utils/expect-http-exception';
import { mockRequest } from '@test/utils/user-helpers';

import { FecharCiclo } from '../fechar-ciclo';
import { CicloBuilder } from './builders/ciclo.builder';

describe('FecharCiclo', () => {
  let useCase: FecharCiclo;
  const readRepo = mock<CicloReadRepository>();
  const writeRepo = mock<CicloWriteRepository>();

  const inputBase = {
    clienteId: '11111111-1111-4111-8111-111111111111',
    numero: 2,
    ano: 2024,
    observacao: 'Fechamento teste',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FecharCiclo,
        { provide: CicloReadRepository, useValue: readRepo },
        { provide: CicloWriteRepository, useValue: writeRepo },
        { provide: 'REQUEST', useValue: mockRequest({ tenantId: 'test-cliente-id' }) },
      ],
    }).compile();
    useCase = module.get<FecharCiclo>(FecharCiclo);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('deve fechar ciclo: chamar writeRepository.fecharCiclo com id, dataFechamento, fechadoPor, observação', async () => {
    const agora = new Date('2025-07-01T14:00:00Z');
    jest.setSystemTime(agora);

    const ciclo = new CicloBuilder().withId('fechar-id').withNumero(2).withAno(2024).withStatus('ativo').build();
    readRepo.findByNumeroAno.mockResolvedValue(ciclo);
    const snapshot = { total: 10 };
    writeRepo.fecharCiclo.mockResolvedValue({ snapshot });

    await useCase.execute(inputBase);

    expect(readRepo.findByNumeroAno).toHaveBeenCalledWith('test-cliente-id', 2, 2024);
    expect(writeRepo.fecharCiclo).toHaveBeenCalledWith('fechar-id', {
      dataFechamento: agora,
      fechadoPor: 'test-user-id',
      observacaoFechamento: 'Fechamento teste',
    });
  });

  it('deve retornar ok=true, numero, ano, snapshot', async () => {
    jest.setSystemTime(new Date('2025-01-01T00:00:00Z'));

    const ciclo = new CicloBuilder().withNumero(3).withAno(2024).build();
    readRepo.findByNumeroAno.mockResolvedValue(ciclo);
    const snapshot = { k: 'v' };
    writeRepo.fecharCiclo.mockResolvedValue({ snapshot });

    const result = await useCase.execute(inputBase);

    expect(result).toEqual({
      ok: true,
      numero: 3,
      ano: 2024,
      snapshot,
    });
  });

  it('deve rejeitar ciclo não encontrado', async () => {
    readRepo.findByNumeroAno.mockResolvedValue(null);

    await expectHttpException(() => useCase.execute(inputBase), CicloException.notFound());
    expect(writeRepo.fecharCiclo).not.toHaveBeenCalled();
  });

  it('deve rejeitar ciclo já fechado', async () => {
    const ciclo = new CicloBuilder().withStatus('fechado').build();
    readRepo.findByNumeroAno.mockResolvedValue(ciclo);

    await expectHttpException(() => useCase.execute(inputBase), CicloException.jaFechado());
    expect(writeRepo.fecharCiclo).not.toHaveBeenCalled();
  });
});
