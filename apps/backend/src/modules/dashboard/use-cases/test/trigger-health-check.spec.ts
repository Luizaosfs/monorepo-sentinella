import { TriggerHealthCheck } from '../trigger-health-check';

describe('TriggerHealthCheck', () => {
  it('chama healthCheck.check() e grava em system_health_log', async () => {
    const checkResult = { status: 'ok', checks: { database: true } };
    const healthCheck = { check: jest.fn().mockResolvedValue(checkResult) };
    const create = jest.fn().mockResolvedValue({});
    const uc = new TriggerHealthCheck(
      { client: { system_health_log: { create } } } as never,
      healthCheck as never,
    );

    const result = await uc.execute();

    expect(healthCheck.check).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ servico: 'manual', status: 'ok' }),
      }),
    );
    expect(result).toEqual(checkResult);
  });

  it('propaga status degraded para o log', async () => {
    const checkResult = { status: 'degraded', checks: { database: false } };
    const healthCheck = { check: jest.fn().mockResolvedValue(checkResult) };
    const create = jest.fn().mockResolvedValue({});
    const uc = new TriggerHealthCheck(
      { client: { system_health_log: { create } } } as never,
      healthCheck as never,
    );

    const result = await uc.execute();
    expect(result.status).toBe('degraded');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'degraded' }) }),
    );
  });
});
