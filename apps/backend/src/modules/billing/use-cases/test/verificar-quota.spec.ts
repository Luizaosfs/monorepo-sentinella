import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { ClienteQuotas } from '../../entities/billing';
import { BillingReadRepository } from '../../repositories/billing-read.repository';

import { VerificarQuota } from '../verificar-quota';

describe('VerificarQuota', () => {
  let useCase: VerificarQuota;
  const readRepo = mock<BillingReadRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificarQuota,
        { provide: BillingReadRepository, useValue: readRepo },
      ],
    }).compile();

    useCase = module.get<VerificarQuota>(VerificarQuota);
  });

  it('deve retornar ok=true quando uso <= limite (happy path)', async () => {
    readRepo.findUsoMensal.mockResolvedValue({
      clienteId: 'cli-1',
      voosMes: 3,
      levantamentosMes: 0,
      itensMes: 0,
      usuariosAtivos: 0,
    });
    readRepo.findQuotas.mockResolvedValue(
      new ClienteQuotas({ clienteId: 'cli-1', voosMes: 10 }, {}),
    );

    const result = await useCase.execute('cli-1', { metrica: 'voos_mes' } as any);

    expect(result).toEqual({ ok: true, usado: 3, limite: 10 });
  });

  it('deve retornar ok=false quando quota excedida', async () => {
    readRepo.findUsoMensal.mockResolvedValue({
      clienteId: 'cli-1',
      voosMes: 15,
      levantamentosMes: 0,
      itensMes: 0,
      usuariosAtivos: 0,
    });
    readRepo.findQuotas.mockResolvedValue(
      new ClienteQuotas({ clienteId: 'cli-1', voosMes: 10 }, {}),
    );

    const result = await useCase.execute('cli-1', { metrica: 'voos_mes' } as any);

    expect(result).toEqual({ ok: false, usado: 15, limite: 10 });
  });

  it('deve retornar ok=true com limite=null quando cliente não tem quotas', async () => {
    readRepo.findUsoMensal.mockResolvedValue({
      clienteId: 'cli-1',
      voosMes: 100,
      levantamentosMes: 0,
      itensMes: 0,
      usuariosAtivos: 0,
    });
    readRepo.findQuotas.mockResolvedValue(null);

    const result = await useCase.execute('cli-1', { metrica: 'voos_mes' } as any);

    expect(result).toEqual({ ok: true, usado: 100, limite: null });
  });
});
