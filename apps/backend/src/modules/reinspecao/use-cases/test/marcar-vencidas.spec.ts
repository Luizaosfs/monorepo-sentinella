import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { ReinspecaoWriteRepository } from '../../repositories/reinspecao-write.repository';
import { MarcarVencidas } from '../marcar-vencidas';

describe('MarcarVencidas', () => {
  let useCase: MarcarVencidas;
  const writeRepo = mock<ReinspecaoWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [MarcarVencidas, { provide: ReinspecaoWriteRepository, useValue: writeRepo }],
    }).compile();

    useCase = module.get<MarcarVencidas>(MarcarVencidas);
  });

  it('deve delegar a writeRepository.marcarPendentesVencidas e retornar atualizadas', async () => {
    writeRepo.marcarPendentesVencidas.mockResolvedValue({ atualizadas: 7 });

    const result = await useCase.execute();

    expect(result).toEqual({ atualizadas: 7 });
    expect(writeRepo.marcarPendentesVencidas).toHaveBeenCalled();
  });
});
