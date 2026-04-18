import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { ClienteQuotas } from '../../entities/billing';
import { BillingReadRepository } from '../../repositories/billing-read.repository';
import { GetQuotas } from '../get-quotas';

describe('GetQuotas', () => {
  let useCase: GetQuotas;
  const readRepo = mock<BillingReadRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetQuotas,
        { provide: BillingReadRepository, useValue: readRepo },
      ],
    }).compile();

    useCase = module.get<GetQuotas>(GetQuotas);
  });

  it('deve retornar quotas do cliente quando existem', async () => {
    const quotas = new ClienteQuotas(
      { clienteId: 'cli-1', voosMes: 100, levantamentosMes: 50 },
      {},
    );
    readRepo.findQuotas.mockResolvedValue(quotas);

    const result = await useCase.execute('cli-1');

    expect(result.quotas).toBe(quotas);
    expect(readRepo.findQuotas).toHaveBeenCalledWith('cli-1');
  });

  it('deve retornar null quando cliente não tem quotas configuradas', async () => {
    readRepo.findQuotas.mockResolvedValue(null);

    const result = await useCase.execute('cli-sem-quotas');

    expect(result.quotas).toBeNull();
  });
});
