import { BadRequestException } from '@nestjs/common';
import { ResolverStatusItem } from '../resolver-status-item';

const mockFocoFindFirst = jest.fn();
const mockFocoUpdate = jest.fn();
const mockHistoricoCreate = jest.fn();
const mockTransaction = jest.fn().mockImplementation((ops: unknown[]) => Promise.all(ops));
const mockPrisma = {
  client: {
    focos_risco: { findFirst: mockFocoFindFirst, update: mockFocoUpdate },
    foco_risco_historico: { create: mockHistoricoCreate },
    $transaction: mockTransaction,
  },
} as any;

describe('ResolverStatusItem', () => {
  let useCase: ResolverStatusItem;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new ResolverStatusItem(mockPrisma);
  });

  it('deve resolver foco em_tratamento com sucesso', async () => {
    mockFocoFindFirst.mockResolvedValue({ id: 'foco-1', status: 'em_tratamento' });
    mockTransaction.mockResolvedValue([{}, {}]);

    await useCase.execute('item-1', 'cliente-1', 'usuario-1');

    expect(mockFocoFindFirst).toHaveBeenCalledWith({
      where: { origem_levantamento_item_id: 'item-1', cliente_id: 'cliente-1', deleted_at: null },
      select: { id: true, status: true },
    });
    expect(mockTransaction).toHaveBeenCalled();
  });

  it('deve ser no-op quando foco não encontrado (item legado)', async () => {
    mockFocoFindFirst.mockResolvedValue(null);

    await useCase.execute('item-sem-foco', 'cliente-1');

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('deve ser no-op quando foco já está resolvido', async () => {
    mockFocoFindFirst.mockResolvedValue({ id: 'foco-1', status: 'resolvido' });

    await useCase.execute('item-1', 'cliente-1');

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('deve lançar BadRequestException para transição inválida', async () => {
    mockFocoFindFirst.mockResolvedValue({ id: 'foco-1', status: 'suspeita' });

    await expect(useCase.execute('item-1', 'cliente-1')).rejects.toThrow(BadRequestException);
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
