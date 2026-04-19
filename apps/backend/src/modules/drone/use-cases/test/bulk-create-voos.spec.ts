import { BulkCreateVoos } from '../bulk-create-voos';

describe('BulkCreateVoos', () => {
  let uc: BulkCreateVoos;
  let createMany: jest.Mock;

  beforeEach(() => {
    createMany = jest.fn().mockResolvedValue({ count: 0 });
    uc = new BulkCreateVoos({ client: { voos: { createMany } } } as never);
  });

  it('returns importados = 0 when createMany returns count 0', async () => {
    const result = await uc.execute({ rows: [{ inicio: new Date() }] });
    expect(result.importados).toBe(0);
  });

  it('processes in chunks of 50', async () => {
    createMany.mockResolvedValue({ count: 50 });
    const rows = Array.from({ length: 110 }, () => ({ inicio: new Date() }));
    await uc.execute({ rows });
    // 3 chunks: 50 + 50 + 10
    expect(createMany).toHaveBeenCalledTimes(3);
  });

  it('sums importados across all chunks', async () => {
    createMany.mockResolvedValue({ count: 5 });
    const rows = Array.from({ length: 60 }, () => ({ inicio: new Date() }));
    const result = await uc.execute({ rows });
    expect(result.importados).toBe(10); // 2 chunks (50 + 10) × count=5 each
  });
});
