import { EnsureCicloEditavel } from '../ensure-ciclo-editavel';

describe('EnsureCicloEditavel', () => {
  let uc: EnsureCicloEditavel;
  let findFirst: jest.Mock;

  beforeEach(() => {
    findFirst = jest.fn();
    uc = new EnsureCicloEditavel({
      client: { ciclos: { findFirst } },
    } as never);
  });

  it('resolves when ciclo is ativo', async () => {
    findFirst.mockResolvedValue({ status: 'ativo' });
    await expect(uc.execute('ciclo-1', 'cli-1')).resolves.toBeUndefined();
  });

  it('resolves when ciclo is planejamento', async () => {
    findFirst.mockResolvedValue({ status: 'planejamento' });
    await expect(uc.execute('ciclo-1', 'cli-1')).resolves.toBeUndefined();
  });

  it('throws when ciclo is fechado', async () => {
    findFirst.mockResolvedValue({ status: 'fechado' });
    await expect(uc.execute('ciclo-1', 'cli-1')).rejects.toMatchObject({
      status: 403,
    });
  });

  it('throws when ciclo not found for this cliente', async () => {
    findFirst.mockResolvedValue(null);
    await expect(uc.execute('ciclo-1', 'cli-1')).rejects.toMatchObject({
      status: 400,
    });
  });

  it('queries with correct ciclo_id and cliente_id', async () => {
    findFirst.mockResolvedValue({ status: 'ativo' });
    await uc.execute('ciclo-uuid-1', 'cli-uuid-1');
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'ciclo-uuid-1', cliente_id: 'cli-uuid-1' },
      select: { status: true },
    });
  });
});
