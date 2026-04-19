import { GetDroneRiskConfig } from '../get-drone-risk-config';

describe('GetDroneRiskConfig', () => {
  let uc: GetDroneRiskConfig;
  let findFirst: jest.Mock;

  beforeEach(() => {
    findFirst = jest.fn().mockResolvedValue(null);
    uc = new GetDroneRiskConfig({ client: { sentinela_drone_risk_config: { findFirst } } } as never);
  });

  it('throws riskConfigNotFound when config does not exist', async () => {
    await expect(uc.execute('cli-1')).rejects.toThrow();
  });

  it('returns config when found', async () => {
    const cfg = { id: 'cfg-1', cliente_id: 'cli-1' };
    findFirst.mockResolvedValue(cfg);
    const result = await uc.execute('cli-1');
    expect(result).toEqual(cfg);
  });

  it('filters by cliente_id (tenant isolation)', async () => {
    await uc.execute('cli-1').catch(() => {});
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { cliente_id: 'cli-1' },
    }));
  });
});
