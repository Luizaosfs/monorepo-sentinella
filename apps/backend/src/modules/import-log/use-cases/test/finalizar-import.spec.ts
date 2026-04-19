import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FinalizarImport } from '../finalizar-import';

describe('FinalizarImport', () => {
  it('finaliza import com contagens e status concluido', async () => {
    const existing = { id: 'log-1', cliente_id: 'c1' };
    const updated  = { id: 'log-1', status: 'concluido', importados: 10 };
    const findFirst = jest.fn().mockResolvedValue(existing);
    const update    = jest.fn().mockResolvedValue(updated);
    const uc = new FinalizarImport({ client: { import_log: { findFirst, update } } } as never);

    const result = await uc.execute('log-1', 'c1', { importados: 10, comErro: 0 });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'log-1' },
        data: expect.objectContaining({ importados: 10, status: 'concluido' }),
      }),
    );
    expect(result).toEqual(updated);
  });

  it('deve rejeitar quando log não pertence ao tenant (IDOR)', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'log-1', cliente_id: 'outro-tenant' });
    const uc = new FinalizarImport({ client: { import_log: { findFirst } } } as never);

    await expect(uc.execute('log-1', 'c1', {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lança NotFoundException quando log não existe', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const uc = new FinalizarImport({ client: { import_log: { findFirst } } } as never);

    await expect(uc.execute('log-1', 'c1', {})).rejects.toBeInstanceOf(NotFoundException);
  });
});
