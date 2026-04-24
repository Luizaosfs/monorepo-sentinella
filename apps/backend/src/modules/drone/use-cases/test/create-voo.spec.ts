import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';
import { ForbiddenException } from '@nestjs/common';

import { VerificarQuota } from '../../../billing/use-cases/verificar-quota';
import { DroneWriteRepository } from '../../repositories/drone-write.repository';
import { CreateVoo } from '../create-voo';

describe('CreateVoo', () => {
  let useCase: CreateVoo;
  const writeRepo = mock<DroneWriteRepository>();
  const mockVerificarQuota = { execute: jest.fn().mockResolvedValue({ ok: true, usado: 0, limite: null }) };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockVerificarQuota.execute.mockResolvedValue({ ok: true, usado: 0, limite: null });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateVoo,
        { provide: DroneWriteRepository, useValue: writeRepo },
        { provide: VerificarQuota, useValue: mockVerificarQuota },
      ],
    }).compile();

    useCase = module.get<CreateVoo>(CreateVoo);
  });

  it('quota ok → cria voo normalmente', async () => {
    const voo = { id: 'voo-1' } as any;
    writeRepo.createVoo.mockResolvedValue(voo);

    const result = await useCase.execute('cliente-1', { planejamentoId: 'plan-1' } as any);

    expect(result.voo).toBe(voo);
    expect(mockVerificarQuota.execute).toHaveBeenCalledWith('cliente-1', { metrica: 'voos_mes' });
  });

  it('quota excedida → throw ForbiddenException', async () => {
    mockVerificarQuota.execute.mockResolvedValue({ ok: false, usado: 10, limite: 10, motivo: 'excedido' });

    await expect(
      useCase.execute('cliente-1', { planejamentoId: 'plan-1' } as any),
    ).rejects.toThrow(ForbiddenException);

    expect(writeRepo.createVoo).not.toHaveBeenCalled();
  });
});
