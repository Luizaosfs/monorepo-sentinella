import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UpdateIntegracaoMeta } from '../update-integracao-meta';

describe('UpdateIntegracaoMeta', () => {
  it('atualiza metadados quando registro pertence ao tenant', async () => {
    const existing = { id: 'i1', cliente_id: 'c1' };
    const updated  = { id: 'i1', ativo: true };
    const findFirst = jest.fn().mockResolvedValue(existing);
    const update    = jest.fn().mockResolvedValue(updated);
    const uc = new UpdateIntegracaoMeta({
      client: { cliente_integracoes: { findFirst, update } },
    } as never);

    const result = await uc.execute('i1', 'c1', { ativo: true });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'i1' } }),
    );
    expect(result).toEqual(updated);
  });

  it('deve rejeitar quando registro não pertence ao tenant (IDOR)', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'i1', cliente_id: 'outro-tenant' });
    const uc = new UpdateIntegracaoMeta({
      client: { cliente_integracoes: { findFirst } },
    } as never);

    await expect(uc.execute('i1', 'c1', {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lança NotFoundException quando integração não existe', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const uc = new UpdateIntegracaoMeta({
      client: { cliente_integracoes: { findFirst } },
    } as never);

    await expect(uc.execute('i1', 'c1', {})).rejects.toBeInstanceOf(NotFoundException);
  });
});
