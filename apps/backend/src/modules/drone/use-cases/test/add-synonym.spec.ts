import { AddSynonym } from '../add-synonym';

describe('AddSynonym', () => {
  let uc: AddSynonym;
  let create: jest.Mock;

  beforeEach(() => {
    create = jest.fn().mockResolvedValue({ id: 'syn-1' });
    uc = new AddSynonym({ client: { sentinela_yolo_synonym: { create } } } as never);
  });

  it('creates synonym with cliente_id from tenantId', async () => {
    await uc.execute('cli-1', { synonym: 'pneu', mapsTo: 'deposito' });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ cliente_id: 'cli-1' }),
    }));
  });

  it('stores trimmed lowercase synonym and mapsTo', async () => {
    await uc.execute('cli-1', { synonym: 'pneu', mapsTo: 'deposito' });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ synonym: 'pneu', maps_to: 'deposito' }),
    }));
  });

  it('returns the created synonym', async () => {
    const result = await uc.execute('cli-1', { synonym: 'a', mapsTo: 'b' });
    expect(result).toEqual({ id: 'syn-1' });
  });
});
