import { REQUEST } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { SlaException } from '../../errors/sla.exception';
import { SlaReadRepository } from '../../repositories/sla-read.repository';
import { SlaWriteRepository } from '../../repositories/sla-write.repository';
import { expectHttpException } from '@test/utils/expect-http-exception';
import { mockRequest } from '@test/utils/user-helpers';

import { EscalarSla } from '../escalar-sla';
import { SlaOperacionalBuilder } from './builders/sla-operacional.builder';

describe('EscalarSla', () => {
  let useCase: EscalarSla;
  const readRepo = mock<SlaReadRepository>();
  const writeRepo = mock<SlaWriteRepository>();

  const requestWithUser = () => mockRequest({
    tenantId: 'test-cliente-id',
    user: { id: 'escalador-user-id' } as never,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscalarSla,
        { provide: SlaReadRepository, useValue: readRepo },
        { provide: SlaWriteRepository, useValue: writeRepo },
        { provide: REQUEST, useValue: requestWithUser() },
      ],
    }).compile();
    useCase = module.get<EscalarSla>(EscalarSla);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('deve escalar P5 → P4, atualizar slaHoras para 72, registrar prioridadeOriginal', async () => {
    jest.setSystemTime(new Date('2025-01-10T12:00:00Z'));

    const sla = new SlaOperacionalBuilder().withPrioridade('P5').withSlaHoras(120).build();
    readRepo.findById.mockResolvedValue(sla);
    writeRepo.save.mockResolvedValue();

    const result = await useCase.execute(sla.id!);

    expect(result.escalado).toBe(true);
    const atual = result.sla!;
    expect(atual.prioridade).toBe('P4');
    expect(atual.slaHoras).toBe(72);
    expect(atual.prioridadeOriginal).toBe('P5');
    expect(atual.escalonado).toBe(true);
    expect(atual.escalonadoEm).toBeInstanceOf(Date);
    expect(atual.escaladoPor).toBe('escalador-user-id');
    expect(atual.prazoFinal.getTime()).toBe(Date.now() + 72 * 3600 * 1000);
    expect(writeRepo.save).toHaveBeenCalledWith(sla);
  });

  it('deve escalar P4 → P3, preservar prioridadeOriginal existente', async () => {
    jest.setSystemTime(new Date('2025-01-10T12:00:00Z'));

    const sla = new SlaOperacionalBuilder()
      .withPrioridade('P4')
      .withSlaHoras(72)
      .withPrioridadeOriginal('P5')
      .build();
    readRepo.findById.mockResolvedValue(sla);
    writeRepo.save.mockResolvedValue();

    const result = await useCase.execute(sla.id!);

    expect(result.escalado).toBe(true);
    const atual = result.sla!;
    expect(atual.prioridade).toBe('P3');
    expect(atual.prioridadeOriginal).toBe('P5');
  });

  it('deve retornar escalado=false se já está em P1 (máximo)', async () => {
    const sla = new SlaOperacionalBuilder().withPrioridade('P1').withSlaHoras(8).build();
    readRepo.findById.mockResolvedValue(sla);

    const result = await useCase.execute(sla.id!);

    expect(result.escalado).toBe(false);
    expect(result.mensagem).toBe('Já está na prioridade máxima');
    expect(writeRepo.save).not.toHaveBeenCalled();
  });

  it('deve retornar escalado=false se prioridade desconhecida (índice -1)', async () => {
    const sla = new SlaOperacionalBuilder().withPrioridade('PX').build();
    readRepo.findById.mockResolvedValue(sla);

    const result = await useCase.execute(sla.id!);

    expect(result.escalado).toBe(false);
    expect(writeRepo.save).not.toHaveBeenCalled();
  });

  it('deve definir escalonado=true, escalonadoEm, recalcular prazoFinal', async () => {
    jest.setSystemTime(new Date('2025-03-01T08:00:00Z'));

    const sla = new SlaOperacionalBuilder().withPrioridade('P5').withSlaHoras(120).build();
    readRepo.findById.mockResolvedValue(sla);
    writeRepo.save.mockResolvedValue();

    const result = await useCase.execute(sla.id!);

    const atual = result.sla!;
    expect(atual.escalonado).toBe(true);
    expect(atual.escalonadoEm).toBeInstanceOf(Date);
    expect(atual.prazoFinal.getTime()).toBe(Date.now() + 72 * 3600 * 1000);
  });

  it('deve rejeitar SLA não encontrado', async () => {
    readRepo.findById.mockResolvedValue(null);

    await expectHttpException(() => useCase.execute('nao-existe'), SlaException.notFound());
  });
});
