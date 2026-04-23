import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { FocoRiscoReadRepository } from '../../repositories/foco-risco-read.repository';
import { FocoRiscoWriteRepository } from '../../repositories/foco-risco-write.repository';
import { RecalcularScorePrioridadeFoco } from '../recalcular-score-prioridade-foco';

describe('RecalcularScorePrioridadeFoco', () => {
  let useCase: RecalcularScorePrioridadeFoco;
  const readRepo = mock<FocoRiscoReadRepository>();
  const writeRepo = mock<FocoRiscoWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecalcularScorePrioridadeFoco,
        { provide: FocoRiscoReadRepository, useValue: readRepo },
        { provide: FocoRiscoWriteRepository, useValue: writeRepo },
      ],
    }).compile();
    useCase = module.get(RecalcularScorePrioridadeFoco);
  });

  it('foco não encontrado → { score: 0 } sem gravação', async () => {
    readRepo.findInputsParaScorePrioridade.mockResolvedValue(null);

    const result = await useCase.execute('foco-inexistente');

    expect(result).toEqual({ score: 0 });
    expect(writeRepo.updateScorePrioridade).not.toHaveBeenCalled();
  });

  it('foco ativo vencido → calcula score=50 e grava', async () => {
    readRepo.findInputsParaScorePrioridade.mockResolvedValue({
      clienteId: 'c1',
      status: 'suspeita',
      focoAnteriorId: null,
      latitude: null,
      longitude: null,
      prazoMinutos: 60,
      tempoNoEstadoMinutos: 70, // vencido → 50
      casosProximosCount: 0,
    });
    writeRepo.updateScorePrioridade.mockResolvedValue();

    const result = await useCase.execute('foco-1');

    expect(result).toEqual({ score: 50 });
    expect(writeRepo.updateScorePrioridade).toHaveBeenCalledWith('foco-1', 50);
  });

  it('foco terminal (resolvido) → score=0 gravado', async () => {
    readRepo.findInputsParaScorePrioridade.mockResolvedValue({
      clienteId: 'c1',
      status: 'resolvido',
      focoAnteriorId: null,
      latitude: null,
      longitude: null,
      prazoMinutos: null,
      tempoNoEstadoMinutos: null,
      casosProximosCount: 0,
    });
    writeRepo.updateScorePrioridade.mockResolvedValue();

    const result = await useCase.execute('foco-terminal');

    expect(result).toEqual({ score: 0 });
    expect(writeRepo.updateScorePrioridade).toHaveBeenCalledWith('foco-terminal', 0);
  });

  it('combina reincidência + casos → score correto', async () => {
    readRepo.findInputsParaScorePrioridade.mockResolvedValue({
      clienteId: 'c1',
      status: 'em_triagem',
      focoAnteriorId: 'foco-anterior',
      latitude: -15.0,
      longitude: -47.0,
      prazoMinutos: 120,
      tempoNoEstadoMinutos: 130, // vencido → 50
      casosProximosCount: 3,     // 15 pts
    });
    writeRepo.updateScorePrioridade.mockResolvedValue();

    const result = await useCase.execute('foco-2');

    expect(result).toEqual({ score: 85 }); // 50 + 20 + 15
    expect(writeRepo.updateScorePrioridade).toHaveBeenCalledWith('foco-2', 85);
  });
});
