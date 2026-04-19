import { RegistrarCheckin } from '../registrar-checkin';

const mockItem = { id: 'item-1', levantamento_id: 'lev-1', deleted_at: null };
const mockFoco = {
  id: 'foco-1',
  cliente_id: 'cliente-1',
  status: 'suspeita',
  deleted_at: null,
  origem_levantamento_item_id: 'item-1',
};

const mockPrismaItens = { findFirst: jest.fn() };
const mockPrismaFocos = { findFirst: jest.fn(), update: jest.fn() };
const mockPrismaHistorico = { create: jest.fn() };
const mockTransaction = jest.fn();
const mockPrisma = {
  client: {
    levantamento_itens: mockPrismaItens,
    focos_risco: mockPrismaFocos,
    foco_risco_historico: mockPrismaHistorico,
    $transaction: mockTransaction,
  },
};

describe('RegistrarCheckin', () => {
  let useCase: RegistrarCheckin;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new RegistrarCheckin(mockPrisma as any);
  });

  it('deve retornar ok:false quando item não existe', async () => {
    mockPrismaItens.findFirst.mockResolvedValue(null);

    const result = await useCase.execute('item-nao-existe');

    expect(result).toEqual({ ok: false, focoId: null });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('deve transicionar foco de suspeita para em_triagem', async () => {
    mockPrismaItens.findFirst.mockResolvedValue(mockItem);
    mockPrismaFocos.findFirst.mockResolvedValue(mockFoco);
    mockTransaction.mockResolvedValue([{}, {}]);

    const result = await useCase.execute('item-1', 'usuario-1');

    expect(result).toEqual({ ok: true, focoId: 'foco-1' });
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it('não deve transicionar quando foco não está em suspeita', async () => {
    mockPrismaItens.findFirst.mockResolvedValue(mockItem);
    mockPrismaFocos.findFirst.mockResolvedValue({ ...mockFoco, status: 'em_triagem' });

    const result = await useCase.execute('item-1');

    expect(result).toEqual({ ok: true, focoId: 'foco-1' });
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('deve retornar focoId:null quando não há foco vinculado ao item', async () => {
    mockPrismaItens.findFirst.mockResolvedValue(mockItem);
    mockPrismaFocos.findFirst.mockResolvedValue(null);

    const result = await useCase.execute('item-1');

    expect(result).toEqual({ ok: true, focoId: null });
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
