import { NotFoundException } from '@nestjs/common';
import { UpdateAgrupamento } from '../update-agrupamento';

describe('UpdateAgrupamento', () => {
  it('atualiza campos quando agrupamento existe', async () => {
    const existing = { id: 'a1', nome: 'Antigo' };
    const updated  = { id: 'a1', nome: 'Novo' };
    const findFirst = jest.fn().mockResolvedValue(existing);
    const update    = jest.fn().mockResolvedValue(updated);
    const uc = new UpdateAgrupamento({ client: { agrupamento_regional: { findFirst, update } } } as never);

    const result = await uc.execute('a1', { nome: 'Novo' });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'a1' } }));
    expect(result).toEqual(updated);
  });

  it('lança NotFoundException quando agrupamento não existe', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const uc = new UpdateAgrupamento({ client: { agrupamento_regional: { findFirst } } } as never);

    await expect(uc.execute('a1', {})).rejects.toBeInstanceOf(NotFoundException);
  });
});
