import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { CicloException } from '../../errors/ciclo.exception';
import { CicloReadRepository } from '../../repositories/ciclo-read.repository';
import { CicloWriteRepository } from '../../repositories/ciclo-write.repository';
import { expectHttpException } from '@test/utils/expect-http-exception';
import { mockRequest } from '@test/utils/user-helpers';

import { AbrirCiclo } from '../abrir-ciclo';
import { CicloBuilder } from './builders/ciclo.builder';

const req = () => mockRequest({ tenantId: 'test-cliente-id' });

describe('AbrirCiclo', () => {
  let useCase: AbrirCiclo;
  const readRepo = mock<CicloReadRepository>();
  const writeRepo = mock<CicloWriteRepository>();

  const baseInput = {
    clienteId: '11111111-1111-4111-8111-111111111111',
    numero: 1 as const,
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AbrirCiclo,
        { provide: CicloReadRepository, useValue: readRepo },
        { provide: CicloWriteRepository, useValue: writeRepo },
        { provide: 'REQUEST', useValue: req() },
      ],
    }).compile();
    useCase = module.get<AbrirCiclo>(AbrirCiclo);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("deve abrir ciclo com status='ativo', calcular datas bimestrais (numero=1 → Jan-Fev)", async () => {
    jest.setSystemTime(new Date('2024-06-15T12:00:00Z'));
    readRepo.findAtivo.mockResolvedValue(null);
    const retornado = new CicloBuilder()
      .withId('novo-ciclo-id')
      .withClienteId('test-cliente-id')
      .withNumero(1)
      .withAno(2024)
      .withStatus('ativo')
      .withDataInicio(new Date(2024, 0, 1))
      .withDataFimPrevista(new Date(2024, 2, 0))
      .build();
    writeRepo.abrirCiclo.mockResolvedValue(retornado);

    const result = await useCase.execute({ ...baseInput, numero: 1, ano: 2024 });

    expect(writeRepo.abrirCiclo).toHaveBeenCalledWith(
      expect.objectContaining({
        clienteId: 'test-cliente-id',
        numero: 1,
        ano: 2024,
        status: 'ativo',
        dataInicio: new Date(2024, 0, 1),
        dataFimPrevista: new Date(2024, 2, 0),
        metaCoberturaPct: 100,
        abertoPor: 'test-user-id',
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.cicloId).toBe('novo-ciclo-id');
  });

  it('deve calcular datas para numero=3 → Mai-Jun (mesInicio=4, dataFimPrevista=30/Jun)', async () => {
    jest.setSystemTime(new Date('2024-06-15T12:00:00Z'));
    readRepo.findAtivo.mockResolvedValue(null);
    const retornado = new CicloBuilder()
      .withId('ciclo-3')
      .withNumero(3)
      .withAno(2024)
      .withDataInicio(new Date(2024, 4, 1))
      .withDataFimPrevista(new Date(2024, 6, 0))
      .build();
    writeRepo.abrirCiclo.mockResolvedValue(retornado);

    await useCase.execute({ ...baseInput, numero: 3, ano: 2024 });

    expect(writeRepo.abrirCiclo).toHaveBeenCalledWith(
      expect.objectContaining({
        dataInicio: new Date(2024, 4, 1),
        dataFimPrevista: new Date(2024, 6, 0),
      }),
    );
  });

  it('deve usar ano atual se input.ano não informado', async () => {
    jest.setSystemTime(new Date('2026-03-10T10:00:00Z'));
    readRepo.findAtivo.mockResolvedValue(null);
    writeRepo.abrirCiclo.mockImplementation(async (e) =>
      new CicloBuilder()
        .withId('c-ano')
        .withClienteId(e.clienteId)
        .withNumero(e.numero)
        .withAno(e.ano)
        .withStatus(e.status)
        .withDataInicio(e.dataInicio)
        .withDataFimPrevista(e.dataFimPrevista)
        .build(),
    );

    await useCase.execute({ ...baseInput, numero: 2 });

    expect(writeRepo.abrirCiclo).toHaveBeenCalledWith(
      expect.objectContaining({
        ano: 2026,
      }),
    );
  });

  it('deve usar metaCoberturaPct=100 como padrão', async () => {
    jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    readRepo.findAtivo.mockResolvedValue(null);
    writeRepo.abrirCiclo.mockResolvedValue(new CicloBuilder().build());

    await useCase.execute({ ...baseInput, numero: 1, ano: 2024 });

    expect(writeRepo.abrirCiclo).toHaveBeenCalledWith(
      expect.objectContaining({ metaCoberturaPct: 100 }),
    );
  });

  it('deve registrar abertoPor com userId do request', async () => {
    jest.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    readRepo.findAtivo.mockResolvedValue(null);
    writeRepo.abrirCiclo.mockResolvedValue(new CicloBuilder().build());

    await useCase.execute({ ...baseInput, numero: 1, ano: 2024 });

    expect(writeRepo.abrirCiclo).toHaveBeenCalledWith(
      expect.objectContaining({ abertoPor: 'test-user-id' }),
    );
  });

  it('deve rejeitar se já existe ciclo ativo', async () => {
    readRepo.findAtivo.mockResolvedValue(new CicloBuilder().withStatus('ativo').build());

    await expectHttpException(
      () => useCase.execute({ ...baseInput, numero: 1, ano: 2024 }),
      CicloException.jaExisteAtivo(),
    );
    expect(writeRepo.abrirCiclo).not.toHaveBeenCalled();
  });
});
