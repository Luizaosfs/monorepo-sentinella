import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { CicloReadRepository } from '../../../ciclo/repositories/ciclo-read.repository';
import { CicloBuilder } from '../../../ciclo/use-cases/test/builders/ciclo.builder';
import { NormalizarCicloFoco } from '../normalizar-ciclo-foco';

describe('NormalizarCicloFoco', () => {
  let service: NormalizarCicloFoco;
  const cicloRepo = mock<CicloReadRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NormalizarCicloFoco,
        { provide: CicloReadRepository, useValue: cicloRepo },
      ],
    }).compile();
    service = module.get<NormalizarCicloFoco>(NormalizarCicloFoco);
  });

  it('retorna numero do ciclo ativo quando cicloInput é undefined', async () => {
    cicloRepo.findAtivo.mockResolvedValue(new CicloBuilder().withNumero(3).build());

    const result = await service.execute('cliente-1');

    expect(result).toBe(3);
    expect(cicloRepo.findAtivo).toHaveBeenCalledWith('cliente-1');
  });

  it('retorna cicloInput quando fornecido e válido (não consulta DB)', async () => {
    const result = await service.execute('cliente-1', 5);

    expect(result).toBe(5);
    expect(cicloRepo.findAtivo).not.toHaveBeenCalled();
  });

  it('retorna undefined quando não há ciclo ativo', async () => {
    cicloRepo.findAtivo.mockResolvedValue(null);

    const result = await service.execute('cliente-1');

    expect(result).toBeUndefined();
  });

  it('cicloInput=0 (fora do range 1-6) → fallback para ciclo ativo', async () => {
    cicloRepo.findAtivo.mockResolvedValue(new CicloBuilder().withNumero(2).build());

    const result = await service.execute('cliente-1', 0);

    expect(result).toBe(2);
  });

  it('cicloInput=99 (fora do range 1-6) → fallback para ciclo ativo', async () => {
    cicloRepo.findAtivo.mockResolvedValue(new CicloBuilder().withNumero(5).build());

    const result = await service.execute('cliente-1', 99);

    expect(result).toBe(5);
  });
});
