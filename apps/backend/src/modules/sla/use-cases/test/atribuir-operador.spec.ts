import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { SlaException } from '../../errors/sla.exception';
import { SlaReadRepository } from '../../repositories/sla-read.repository';
import { SlaWriteRepository } from '../../repositories/sla-write.repository';
import { expectHttpException } from '@test/utils/expect-http-exception';

import { AtribuirOperador } from '../atribuir-operador';
import { SlaOperacionalBuilder } from './builders/sla-operacional.builder';

describe('AtribuirOperador', () => {
  let useCase: AtribuirOperador;
  const readRepo = mock<SlaReadRepository>();
  const writeRepo = mock<SlaWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AtribuirOperador,
        { provide: SlaReadRepository, useValue: readRepo },
        { provide: SlaWriteRepository, useValue: writeRepo },
      ],
    }).compile();
    useCase = module.get<AtribuirOperador>(AtribuirOperador);
  });

  it('deve atribuir operadorId ao SLA', async () => {
    const sla = new SlaOperacionalBuilder().withStatus('pendente').build();
    readRepo.findById.mockResolvedValue(sla);
    writeRepo.save.mockResolvedValue();

    const result = await useCase.execute(sla.id!, {
      operadorId: 'op-1',
      avancarStatus: false,
    });

    expect(result.sla.operadorId).toBe('op-1');
    expect(writeRepo.save).toHaveBeenCalledWith(sla);
  });

  it('deve avançar status para em_atendimento se avancarStatus=true e status=pendente', async () => {
    const sla = new SlaOperacionalBuilder().withStatus('pendente').build();
    readRepo.findById.mockResolvedValue(sla);
    writeRepo.save.mockResolvedValue();

    const result = await useCase.execute(sla.id!, {
      operadorId: 'op-1',
      avancarStatus: true,
    });

    expect(result.sla.status).toBe('em_atendimento');
  });

  it('NÃO deve avançar status se avancarStatus=false', async () => {
    const sla = new SlaOperacionalBuilder().withStatus('pendente').build();
    readRepo.findById.mockResolvedValue(sla);
    writeRepo.save.mockResolvedValue();

    const result = await useCase.execute(sla.id!, {
      operadorId: 'op-1',
      avancarStatus: false,
    });

    expect(result.sla.status).toBe('pendente');
  });

  it('NÃO deve avançar status se status já é em_atendimento', async () => {
    const sla = new SlaOperacionalBuilder().withStatus('em_atendimento').build();
    readRepo.findById.mockResolvedValue(sla);
    writeRepo.save.mockResolvedValue();

    const result = await useCase.execute(sla.id!, {
      operadorId: 'op-1',
      avancarStatus: true,
    });

    expect(result.sla.status).toBe('em_atendimento');
  });

  it('deve rejeitar SLA não encontrado', async () => {
    readRepo.findById.mockResolvedValue(null);

    await expectHttpException(
      () => useCase.execute('nao-existe', { operadorId: 'op-1', avancarStatus: false }),
      SlaException.notFound(),
    );
  });
});
