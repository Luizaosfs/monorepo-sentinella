import { BulkCreateVoos } from '../bulk-create-voos';

describe('BulkCreateVoos', () => {
  let uc: BulkCreateVoos;
  let createMany: jest.Mock;
  let planCount: jest.Mock;

  beforeEach(() => {
    createMany = jest.fn().mockResolvedValue({ count: 0 });
    planCount  = jest.fn().mockResolvedValue(0);
    uc = new BulkCreateVoos({
      client: {
        voos:         { createMany },
        planejamento: { count: planCount },
      },
    } as never);
  });

  it('returns importados = 0 when createMany returns count 0', async () => {
    const result = await uc.execute('cliente-a', { rows: [{ inicio: new Date() }] });
    expect(result.importados).toBe(0);
  });

  it('processes in chunks of 50', async () => {
    createMany.mockResolvedValue({ count: 50 });
    const rows = Array.from({ length: 110 }, () => ({ inicio: new Date() }));
    await uc.execute('cliente-a', { rows });
    // 3 chunks: 50 + 50 + 10
    expect(createMany).toHaveBeenCalledTimes(3);
  });

  it('sums importados across all chunks', async () => {
    createMany.mockResolvedValue({ count: 5 });
    const rows = Array.from({ length: 60 }, () => ({ inicio: new Date() }));
    const result = await uc.execute('cliente-a', { rows });
    expect(result.importados).toBe(10); // 2 chunks (50 + 10) × count=5 each
  });

  it('deve rejeitar quando algum planejamento não pertence ao tenant', async () => {
    planCount.mockResolvedValue(2); // só 2 de 3 pertencem
    const rows = [
      { inicio: new Date(), planejamentoId: 'p1' },
      { inicio: new Date(), planejamentoId: 'p2' },
      { inicio: new Date(), planejamentoId: 'p3' },
    ];
    await expect(uc.execute('cliente-a', { rows })).rejects.toThrow();
    expect(createMany).not.toHaveBeenCalled();
  });

  it('deve aceitar quando todos planejamentos pertencem ao tenant', async () => {
    planCount.mockResolvedValue(2); // 2 únicos, todos do tenant
    createMany.mockResolvedValue({ count: 2 });
    const rows = [
      { inicio: new Date(), planejamentoId: 'p1' },
      { inicio: new Date(), planejamentoId: 'p2' },
    ];
    const result = await uc.execute('cliente-a', { rows });
    expect(result.importados).toBe(2);
    expect(createMany).toHaveBeenCalled();
  });
});
