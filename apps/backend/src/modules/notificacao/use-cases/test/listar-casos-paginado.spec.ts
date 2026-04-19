import { ListarCasosPaginado } from '../listar-casos-paginado';

const mockRow = { id: 'uuid-1', doenca: 'dengue', status: 'suspeito', created_at: new Date('2026-04-01T10:00:00Z') };

describe('ListarCasosPaginado', () => {
  let uc: ListarCasosPaginado;
  let queryRaw: jest.Mock;

  beforeEach(() => {
    queryRaw = jest.fn();
    uc = new ListarCasosPaginado({ client: { $queryRaw: queryRaw } } as never);
  });

  it('returns data and null nextCursor when results ≤ limit', async () => {
    queryRaw.mockResolvedValue([mockRow]);
    const result = await uc.execute('cliente-1', { limit: 20 });
    expect(result.data).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });

  it('returns nextCursor when results exceed limit', async () => {
    const rows = Array.from({ length: 21 }, (_, i) => ({ ...mockRow, id: `uuid-${i}` }));
    queryRaw.mockResolvedValue(rows);
    const result = await uc.execute('cliente-1', { limit: 20 });
    expect(result.data).toHaveLength(20);
    expect(result.nextCursor).not.toBeNull();
    expect(result.nextCursor?.id).toBe('uuid-19');
  });

  it('uses cursor-based query when cursorCreated and cursorId provided', async () => {
    queryRaw.mockResolvedValue([]);
    await uc.execute('cliente-1', {
      limit: 10,
      cursorCreated: '2026-04-01T10:00:00Z',
      cursorId: '00000000-0000-0000-0000-000000000001',
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
    const sql = queryRaw.mock.calls[0][0];
    expect(sql.strings.join('')).toContain('created_at, id');
  });
});
