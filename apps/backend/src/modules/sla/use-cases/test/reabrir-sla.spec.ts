import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { SlaException } from '../../errors/sla.exception';
import { SlaReadRepository } from '../../repositories/sla-read.repository';
import { SlaWriteRepository } from '../../repositories/sla-write.repository';
import { expectHttpException } from '@test/utils/expect-http-exception';

import { ReabrirSla } from '../reabrir-sla';
import { SlaOperacionalBuilder } from './builders/sla-operacional.builder';

describe('ReabrirSla', () => {
  let useCase: ReabrirSla;
  const readRepo = mock<SlaReadRepository>();
  const writeRepo = mock<SlaWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReabrirSla,
        { provide: SlaReadRepository, useValue: readRepo },
        { provide: SlaWriteRepository, useValue: writeRepo },
      ],
    }).compile();
    useCase = module.get<ReabrirSla>(ReabrirSla);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("deve reabrir SLA: status='pendente', concluidoEm=undefined, recalcular prazoFinal", async () => {
    const now = new Date('2025-04-01T15:00:00Z');
    jest.setSystemTime(now);

    const sla = new SlaOperacionalBuilder()
      .withStatus('concluido')
      .withSlaHoras(48)
      .withConcluidoEm(new Date('2025-03-30T10:00:00Z'))
      .build();
    readRepo.findById.mockResolvedValue(sla);
    writeRepo.save.mockResolvedValue();

    const result = await useCase.execute(sla.id!, null);

    expect(result.sla.status).toBe('pendente');
    expect(result.sla.concluidoEm).toBeUndefined();
    expect(result.sla.prazoFinal.getTime()).toBe(now.getTime() + 48 * 3600 * 1000);
    expect(writeRepo.save).toHaveBeenCalledWith(sla);
  });

  it('deve rejeitar SLA não encontrado', async () => {
    readRepo.findById.mockResolvedValue(null);

    await expectHttpException(() => useCase.execute('nao-existe', null), SlaException.notFound());
  });
});
