import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { CicloReadRepository } from '../../../ciclo/repositories/ciclo-read.repository';
import { CicloBuilder } from '../../../ciclo/use-cases/test/builders/ciclo.builder';
import { ValidarCicloVistoria } from '../validar-ciclo-vistoria';

describe('ValidarCicloVistoria', () => {
  let service: ValidarCicloVistoria;
  const cicloRepo = mock<CicloReadRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ValidarCicloVistoria,
        { provide: CicloReadRepository, useValue: cicloRepo },
      ],
    }).compile();
    service = module.get<ValidarCicloVistoria>(ValidarCicloVistoria);
  });

  it('ciclo undefined + ciclo ativo=1 → ok (aplica default 1)', async () => {
    cicloRepo.findAtivo.mockResolvedValue(new CicloBuilder().withNumero(1).build());

    await expect(service.execute('c1', undefined)).resolves.toBeUndefined();
  });

  it('ciclo undefined + ciclo ativo=3 → BadRequestException (default 1 ≠ 3)', async () => {
    cicloRepo.findAtivo.mockResolvedValue(new CicloBuilder().withNumero(3).build());

    await expect(service.execute('c1', undefined)).rejects.toThrow(BadRequestException);
  });

  it('ciclo coincide com ativo → ok', async () => {
    cicloRepo.findAtivo.mockResolvedValue(new CicloBuilder().withNumero(2).build());

    await expect(service.execute('c1', 2)).resolves.toBeUndefined();
  });

  it('ciclo difere do ativo → BadRequestException', async () => {
    cicloRepo.findAtivo.mockResolvedValue(new CicloBuilder().withNumero(2).build());

    await expect(service.execute('c1', 1)).rejects.toThrow(BadRequestException);
  });

  it('sem ciclo ativo → não valida (best-effort)', async () => {
    cicloRepo.findAtivo.mockResolvedValue(null);

    await expect(service.execute('c1', 5)).resolves.toBeUndefined();
  });
});
