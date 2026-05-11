import { UpsertDistribuicoes } from '../upsert-distribuicoes';

describe('UpsertDistribuicoes', () => {
  let uc: UpsertDistribuicoes;
  let executeRaw: jest.Mock;
  let ensureEditavel: jest.Mock;

  beforeEach(() => {
    executeRaw = jest.fn().mockResolvedValue(1);
    ensureEditavel = jest.fn().mockResolvedValue(undefined);

    uc = new UpsertDistribuicoes(
      { client: { $executeRaw: executeRaw } } as never,
      { execute: ensureEditavel } as never,
      { user: { id: 'user-uuid-1' } } as never,
    );
  });

  it('executes bulk upsert via $executeRaw', async () => {
    await uc.execute('cli-1', {
      rows: [
        { cicloId: 'ciclo-uuid-1', quadraId: 'quadra-uuid-1', agenteId: '00000000-0000-0000-0000-000000000001' },
        { cicloId: 'ciclo-uuid-1', quadraId: 'quadra-uuid-2', agenteId: '00000000-0000-0000-0000-000000000002' },
      ],
    });
    expect(executeRaw).toHaveBeenCalled();
  });

  it('skips DB call when rows is empty', async () => {
    await uc.execute('cli-1', { rows: [] } as never);
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it('blocks execution when ciclo is fechado', async () => {
    ensureEditavel.mockRejectedValueOnce(new Error('ciclo fechado'));
    await expect(uc.execute('cli-1', {
      rows: [{ cicloId: 'ciclo-uuid-1', quadraId: 'quadra-uuid-1', agenteId: '00000000-0000-0000-0000-000000000001' }],
    })).rejects.toThrow();
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it('validates ciclo using the first row cicloId', async () => {
    await uc.execute('cli-1', {
      rows: [{ cicloId: 'ciclo-uuid-2', quadraId: 'quadra-uuid-3', agenteId: '00000000-0000-0000-0000-000000000003' }],
    });
    expect(ensureEditavel).toHaveBeenCalledWith('ciclo-uuid-2', 'cli-1');
    expect(executeRaw).toHaveBeenCalled();
  });
});
