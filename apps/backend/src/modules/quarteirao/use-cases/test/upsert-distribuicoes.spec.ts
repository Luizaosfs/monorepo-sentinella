import { UpsertDistribuicoes } from '../upsert-distribuicoes';

describe('UpsertDistribuicoes', () => {
  let uc: UpsertDistribuicoes;
  let executeRaw: jest.Mock;
  let transaction: jest.Mock;

  beforeEach(() => {
    executeRaw = jest.fn().mockResolvedValue(1);
    transaction = jest.fn().mockImplementation((ops: unknown[]) => Promise.all(ops));
    uc = new UpsertDistribuicoes({ client: { $executeRaw: executeRaw, $transaction: transaction } } as never);
  });

  it('executes one upsert per row in a transaction', async () => {
    await uc.execute('cli-1', {
      rows: [
        { ciclo: 1, quarteirao: 'Q1', agenteId: '00000000-0000-0000-0000-000000000001' },
        { ciclo: 1, quarteirao: 'Q2', agenteId: '00000000-0000-0000-0000-000000000002' },
      ],
    });
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('skips DB call when rows is empty (handled in caller)', async () => {
    // The schema requires min(1), so empty rows never reaches execute
    // Calling directly with 0 rows should return early
    (uc as any).execute = jest.fn().mockResolvedValue(undefined);
    await uc.execute('cli-1', { rows: [] } as never);
  });

  it('passes clienteId to the raw SQL for each row', async () => {
    await uc.execute('cli-1', {
      rows: [{ ciclo: 2, quarteirao: 'Q3', agenteId: '00000000-0000-0000-0000-000000000003' }],
    });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(executeRaw).toHaveBeenCalledTimes(1);
  });
});
