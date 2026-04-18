import { Test, TestingModule } from '@nestjs/testing';
import { mock } from 'jest-mock-extended';

import { ClienteQuotas } from '../../entities/billing';
import { BillingWriteRepository } from '../../repositories/billing-write.repository';
import { UpsertQuotas } from '../upsert-quotas';

describe('UpsertQuotas', () => {
  let useCase: UpsertQuotas;
  const writeRepo = mock<BillingWriteRepository>();

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpsertQuotas,
        { provide: BillingWriteRepository, useValue: writeRepo },
      ],
    }).compile();

    useCase = module.get<UpsertQuotas>(UpsertQuotas);
  });

  it('deve fazer upsert de quotas para o cliente', async () => {
    const result = new ClienteQuotas(
      { clienteId: 'cli-1', voosMes: 50, levantamentosMes: 20 },
      {},
    );
    writeRepo.upsertQuotas.mockResolvedValue(result);

    const out = await useCase.execute('cli-1', {
      voosMes: 50,
      levantamentosMes: 20,
    } as any);

    expect(out.quotas).toBe(result);
    expect(writeRepo.upsertQuotas).toHaveBeenCalledTimes(1);
  });

  it('deve propagar erro do repository', async () => {
    writeRepo.upsertQuotas.mockRejectedValue(new Error('fk-violation'));

    await expect(useCase.execute('cli-1', {} as any)).rejects.toThrow(
      'fk-violation',
    );
  });
});
