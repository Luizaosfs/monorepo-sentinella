import { UpdateDroneRiskConfig } from '../update-drone-risk-config';

describe('UpdateDroneRiskConfig', () => {
  let uc: UpdateDroneRiskConfig;
  let findFirst: jest.Mock;
  let update: jest.Mock;

  beforeEach(() => {
    findFirst = jest.fn().mockResolvedValue({ id: 'cfg-1' });
    update    = jest.fn().mockResolvedValue({});
    uc = new UpdateDroneRiskConfig({
      client: { sentinela_drone_risk_config: { findFirst, update } },
    } as never);
  });

  it('throws when config not found for tenant', async () => {
    findFirst.mockResolvedValue(null);
    await expect(uc.execute('cli-1', {})).rejects.toThrow();
  });

  it('verifies ownership via cliente_id before update (IDOR)', async () => {
    await uc.execute('cli-1', { confidenceMultiplier: 1.2 });
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { cliente_id: 'cli-1' },
    }));
  });

  it('updates only provided fields', async () => {
    await uc.execute('cli-1', { confidenceMultiplier: 1.5 });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ confidence_multiplier: 1.5 }),
    }));
  });
});
