import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { SlaException } from '../../errors/sla.exception';
import { SlaReadRepository } from '../../repositories/sla-read.repository';
import { SlaWriteRepository } from '../../repositories/sla-write.repository';
import { expectHttpException } from '@test/utils/expect-http-exception';

import { AtribuirAgente } from '../atribuir-agente';
import { SlaOperacionalBuilder } from './builders/sla-operacional.builder';

describe('AtribuirAgente', () => {
  let useCase: AtribuirAgente;
  const readRepo = mock<SlaReadRepository>();
  const writeRepo = mock<SlaWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AtribuirAgente,
        { provide: SlaReadRepository, useValue: readRepo },
        { provide: SlaWriteRepository, useValue: writeRepo },
      ],
    }).compile();
    useCase = module.get<AtribuirAgente>(AtribuirAgente);
  });

  it('deve atribuir agenteId ao SLA', async () => {
    const sla = new SlaOperacionalBuilder().withStatus('pendente').build();
    readRepo.findById.mockResolvedValue(sla);
    writeRepo.save.mockResolvedValue();

    const result = await useCase.execute(sla.id!, {
      agenteId: 'op-1',
      avancarStatus: false,
    }, null);

    expect(result.sla.agenteId).toBe('op-1');
    expect(writeRepo.save).toHaveBeenCalledWith(sla);
  });

  it('deve avançar status para em_atendimento se avancarStatus=true e status=pendente', async () => {
    const sla = new SlaOperacionalBuilder().withStatus('pendente').build();
    readRepo.findById.mockResolvedValue(sla);
    writeRepo.save.mockResolvedValue();

    const result = await useCase.execute(sla.id!, {
      agenteId: 'op-1',
      avancarStatus: true,
    }, null);

    expect(result.sla.status).toBe('em_atendimento');
  });

  it('NÃO deve avançar status se avancarStatus=false', async () => {
    const sla = new SlaOperacionalBuilder().withStatus('pendente').build();
    readRepo.findById.mockResolvedValue(sla);
    writeRepo.save.mockResolvedValue();

    const result = await useCase.execute(sla.id!, {
      agenteId: 'op-1',
      avancarStatus: false,
    }, null);

    expect(result.sla.status).toBe('pendente');
  });

  it('NÃO deve avançar status se status já é em_atendimento', async () => {
    const sla = new SlaOperacionalBuilder().withStatus('em_atendimento').build();
    readRepo.findById.mockResolvedValue(sla);
    writeRepo.save.mockResolvedValue();

    const result = await useCase.execute(sla.id!, {
      agenteId: 'op-1',
      avancarStatus: true,
    }, null);

    expect(result.sla.status).toBe('em_atendimento');
  });

  it('deve rejeitar SLA não encontrado', async () => {
    readRepo.findById.mockResolvedValue(null);

    await expectHttpException(
      () => useCase.execute('nao-existe', { agenteId: 'op-1', avancarStatus: false }, null),
      SlaException.notFound(),
    );
  });
});
