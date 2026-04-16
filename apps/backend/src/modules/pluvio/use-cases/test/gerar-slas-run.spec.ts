import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { expectHttpException } from '@test/utils/expect-http-exception';

import { PluvioException } from '../../errors/pluvio.exception';
import { PluvioReadRepository } from '../../repositories/pluvio-read.repository';
import { PluvioWriteRepository } from '../../repositories/pluvio-write.repository';
import { GerarSlasRun } from '../gerar-slas-run';
import { PluvioItemBuilder, PluvioRunBuilder } from './builders/pluvio.builder';

describe('GerarSlasRun', () => {
  let useCase: GerarSlasRun;
  const readRepo = mock<PluvioReadRepository>();
  const writeRepo = mock<PluvioWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GerarSlasRun,
        { provide: PluvioReadRepository, useValue: readRepo },
        { provide: PluvioWriteRepository, useValue: writeRepo },
      ],
    }).compile();

    useCase = module.get<GerarSlasRun>(GerarSlasRun);
  });

  it('deve gerar SLAs apenas para alto e critico com prioridade e prazos corretos', async () => {
    const run = new PluvioRunBuilder().withClienteId('cliente-sla').build();
    const iBaixo = new PluvioItemBuilder().withNivelRisco('baixo').withId('00000000-0000-4000-8000-000000000001').build();
    const iMedio = new PluvioItemBuilder().withNivelRisco('medio').withId('00000000-0000-4000-8000-000000000002').build();
    const iAlto = new PluvioItemBuilder().withNivelRisco('alto').withId('00000000-0000-4000-8000-000000000003').build();
    const iCritico = new PluvioItemBuilder().withNivelRisco('critico').withId('00000000-0000-4000-8000-000000000004').build();

    readRepo.findRunById.mockResolvedValue(run);
    readRepo.findItemsByRunId.mockResolvedValue([iBaixo, iMedio, iAlto, iCritico]);
    writeRepo.createSlasBulk.mockResolvedValue(2);

    const result = await useCase.execute(run.id!);

    expect(result.criados).toBe(2);
    expect(writeRepo.createSlasBulk).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          clienteId: run.clienteId,
          itemId: iAlto.id,
          prioridade: 'alta',
          slaHoras: 48,
        }),
        expect.objectContaining({
          clienteId: run.clienteId,
          itemId: iCritico.id,
          prioridade: 'critica',
          slaHoras: 24,
        }),
      ]),
    );
    expect(writeRepo.createSlasBulk.mock.calls[0][0]).toHaveLength(2);
  });

  it('deve ignorar itens com nivelRisco baixo ou medio', async () => {
    const run = new PluvioRunBuilder().build();
    const iBaixo = new PluvioItemBuilder().withNivelRisco('baixo').build();
    const iMedio = new PluvioItemBuilder().withNivelRisco('medio').build();
    readRepo.findRunById.mockResolvedValue(run);
    readRepo.findItemsByRunId.mockResolvedValue([iBaixo, iMedio]);
    writeRepo.createSlasBulk.mockResolvedValue(0);

    await useCase.execute(run.id!);

    expect(writeRepo.createSlasBulk).toHaveBeenCalledWith([]);
  });

  it('deve rejeitar run não encontrada', async () => {
    readRepo.findRunById.mockResolvedValue(null);

    await expectHttpException(() => useCase.execute('missing-run'), PluvioException.notFound());
    expect(writeRepo.createSlasBulk).not.toHaveBeenCalled();
  });
});
