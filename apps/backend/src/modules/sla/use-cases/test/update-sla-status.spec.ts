import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { SlaException } from '../../errors/sla.exception';
import { SlaReadRepository } from '../../repositories/sla-read.repository';
import { SlaWriteRepository } from '../../repositories/sla-write.repository';
import { expectHttpException } from '@test/utils/expect-http-exception';

import { UpdateSlaStatus } from '../update-sla-status';
import { SlaOperacionalBuilder } from './builders/sla-operacional.builder';

describe('UpdateSlaStatus', () => {
  let useCase: UpdateSlaStatus;
  const readRepo = mock<SlaReadRepository>();
  const writeRepo = mock<SlaWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdateSlaStatus,
        { provide: SlaReadRepository, useValue: readRepo },
        { provide: SlaWriteRepository, useValue: writeRepo },
      ],
    }).compile();
    useCase = module.get<UpdateSlaStatus>(UpdateSlaStatus);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('deve atualizar status do SLA', async () => {
    jest.setSystemTime(new Date('2025-05-01T09:00:00Z'));

    const sla = new SlaOperacionalBuilder().withStatus('pendente').build();
    readRepo.findById.mockResolvedValue(sla);
    writeRepo.save.mockResolvedValue();

    const result = await useCase.execute(sla.id!, { status: 'em_atendimento' });

    expect(result.sla.status).toBe('em_atendimento');
    expect(writeRepo.save).toHaveBeenCalledWith(sla);
  });

  it('deve preencher concluidoEm ao mudar para concluido (se não preenchido)', async () => {
    const agora = new Date('2025-05-02T11:30:00Z');
    jest.setSystemTime(agora);

    const sla = new SlaOperacionalBuilder().withStatus('em_atendimento').build();
    readRepo.findById.mockResolvedValue(sla);
    writeRepo.save.mockResolvedValue();

    const result = await useCase.execute(sla.id!, { status: 'concluido' });

    expect(result.sla.concluidoEm?.getTime()).toBe(agora.getTime());
  });

  it('NÃO deve sobrescrever concluidoEm existente', async () => {
    jest.setSystemTime(new Date('2025-05-02T11:30:00Z'));

    const existente = new Date('2025-04-01T08:00:00Z');
    const sla = new SlaOperacionalBuilder()
      .withStatus('concluido')
      .withConcluidoEm(existente)
      .build();
    readRepo.findById.mockResolvedValue(sla);
    writeRepo.save.mockResolvedValue();

    const result = await useCase.execute(sla.id!, { status: 'concluido' });

    expect(result.sla.concluidoEm?.getTime()).toBe(existente.getTime());
  });

  it('deve rejeitar SLA não encontrado', async () => {
    readRepo.findById.mockResolvedValue(null);

    await expectHttpException(
      () => useCase.execute('nao-existe', { status: 'pendente' }),
      SlaException.notFound(),
    );
  });
});
