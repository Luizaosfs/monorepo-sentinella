import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { ReinspecaoWriteRepository } from '../../repositories/reinspecao-write.repository';
import { CancelarReinspecoesAoFecharFoco } from '../cancelar-reinspecoes-ao-fechar-foco';

describe('CancelarReinspecoesAoFecharFoco', () => {
  let useCase: CancelarReinspecoesAoFecharFoco;
  const writeRepo = mock<ReinspecaoWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CancelarReinspecoesAoFecharFoco,
        { provide: ReinspecaoWriteRepository, useValue: writeRepo },
      ],
    }).compile();
    useCase = module.get(CancelarReinspecoesAoFecharFoco);
  });

  it('cancela reinspeções pendentes do foco com motivo padrão e repassa tx/usuário', async () => {
    writeRepo.cancelarPendentesPorFoco.mockResolvedValue(2);
    const tx = { __mock_tx__: true };

    const count = await useCase.execute('foco-x', 'user-1', tx);

    expect(writeRepo.cancelarPendentesPorFoco).toHaveBeenCalledWith(
      'foco-x',
      'Foco fechado automaticamente',
      'user-1',
      tx,
    );
    expect(count).toBe(2);
  });

  it('idempotente: retorna 0 quando nada havia para cancelar', async () => {
    writeRepo.cancelarPendentesPorFoco.mockResolvedValue(0);

    const count = await useCase.execute('foco-sem-reinsp');

    expect(count).toBe(0);
    expect(writeRepo.cancelarPendentesPorFoco).toHaveBeenCalledWith(
      'foco-sem-reinsp',
      'Foco fechado automaticamente',
      undefined,
      undefined,
    );
  });
});
