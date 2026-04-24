import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { SlaException } from '../../errors/sla.exception';
import { SlaReadRepository } from '../../repositories/sla-read.repository';
import { SlaWriteRepository } from '../../repositories/sla-write.repository';
import { expectHttpException } from '@test/utils/expect-http-exception';

import { ConcluirSla } from '../concluir-sla';
import { SlaOperacionalBuilder } from './builders/sla-operacional.builder';

describe('ConcluirSla', () => {
  let useCase: ConcluirSla;
  const readRepo = mock<SlaReadRepository>();
  const writeRepo = mock<SlaWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConcluirSla,
        { provide: SlaReadRepository, useValue: readRepo },
        { provide: SlaWriteRepository, useValue: writeRepo },
      ],
    }).compile();
    useCase = module.get<ConcluirSla>(ConcluirSla);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('deve concluir SLA e preencher concluidoEm', async () => {
    const agora = new Date('2025-06-01T10:00:00Z');
    jest.setSystemTime(agora);

    const sla = new SlaOperacionalBuilder()
      .withPrazoFinal(new Date('2025-06-02T10:00:00Z'))
      .withViolado(false)
      .build();
    readRepo.findById.mockResolvedValue(sla);
    writeRepo.save.mockResolvedValue();

    const result = await useCase.execute(sla.id!);

    expect(result.sla.status).toBe('concluido');
    expect(result.sla.concluidoEm?.getTime()).toBe(agora.getTime());
    expect(writeRepo.save).toHaveBeenCalledWith(sla);
  });

  it('deve marcar violado=true se prazoFinal < agora', async () => {
    jest.setSystemTime(new Date('2025-06-10T12:00:00Z'));

    const sla = new SlaOperacionalBuilder()
      .withPrazoFinal(new Date('2025-06-01T12:00:00Z'))
      .withViolado(false)
      .build();
    readRepo.findById.mockResolvedValue(sla);
    writeRepo.save.mockResolvedValue();

    const result = await useCase.execute(sla.id!);

    expect(result.sla.violado).toBe(true);
  });

  it('deve manter violado=false se prazoFinal >= agora', async () => {
    jest.setSystemTime(new Date('2025-06-10T12:00:00Z'));

    const sla = new SlaOperacionalBuilder()
      .withPrazoFinal(new Date('2025-06-11T12:00:00Z'))
      .withViolado(false)
      .build();
    readRepo.findById.mockResolvedValue(sla);
    writeRepo.save.mockResolvedValue();

    const result = await useCase.execute(sla.id!);

    expect(result.sla.violado).toBe(false);
  });

  it('deve rejeitar SLA não encontrado', async () => {
    readRepo.findById.mockResolvedValue(null);

    await expectHttpException(() => useCase.execute('nao-existe'), SlaException.notFound());
  });

  // K.2 — trg_sla_reset_escalonado_automatico
  it('K.2 — escalonadoAutomatico=true é resetado para false ao concluir', async () => {
    jest.setSystemTime(new Date('2025-06-01T10:00:00Z'));

    const sla = new SlaOperacionalBuilder()
      .withPrazoFinal(new Date('2025-06-02T10:00:00Z'))
      .withEscalonadoAutomatico(true)
      .build();
    readRepo.findById.mockResolvedValue(sla);
    writeRepo.save.mockResolvedValue();

    const result = await useCase.execute(sla.id!);

    expect(result.sla.escalonadoAutomatico).toBe(false);
  });
});
